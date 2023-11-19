import Papa from 'papaparse';
import yaml from 'js-yaml';
import providerDataDefault from '../data/provider_pricing.yaml';
import ESBDateUtils from './ESBDateUtils';

class EnergyBillEstimator {
    constructor(providerDataContent = providerDataDefault) {
        const parsedData = yaml.load(providerDataContent);

        this.pricingData = this.loadPricingData(parsedData.providers);
        this.standingCharges = this.loadStandingCharges(parsedData.providers);
        this.consumptionData = null;
    }

    static create(providerDataContent) {
        return new EnergyBillEstimator(providerDataContent);
    }

    withConsumption(fileContent) {
        const results = Papa.parse(fileContent, { header: true });
        
        // Split data into imports and exports
        this.importData = results.data
            .filter(row => row['Read Type'] === 'Active Import Interval (kW)')
            .map(row => [row['Read Date and End Time'], parseFloat(row['Read Value'])]);

        this.exportData = results.data
            .filter(row => row['Read Type'] === 'Active Export Interval (kW)')
            .map(row => [row['Read Date and End Time'], parseFloat(row['Read Value'])]);
        
        return this;
    }

    estimate() {
        if (!this.importData) {
            throw new Error("Consumption data not set. Use `withConsumption` before calling `estimate`.");
        }
        return this.estimateBillFromData(this.importData, this.exportData);
    }

    loadStandingCharges(providers) {
        const standingCharges = {};
        providers.forEach(provider => {
            standingCharges[provider.name] = parseFloat(provider.pricings[0].standing_charge); // assuming pricings always has at least one entry
        });
        return standingCharges;
    }

    loadPricingData(providers) {
        const pricingData = {};
        providers.forEach(provider => {
            pricingData[provider.name] = {
                importRates: provider.pricings[0].import_rates.map(rate => [rate.start_time, rate.end_time, parseFloat(rate.price_per_kwh)]),
                exportRates: provider.pricings[0].export_rates ? provider.pricings[0].export_rates.map(rate => [rate.start_time, rate.end_time, parseFloat(rate.price_per_kwh)]) : []
            };
        });
        return pricingData;
    }

    getPriceForTimestamp(provider, timestamp, type = 'import') {
        //const time = moment(timestamp, "DD-MM-YYYY HH:mm").format("HH:mm");
        // not using moment here gives a boost of 10x in execution time
        const time = timestamp.slice(11, 16);
        const rates = type === 'import' ? this.pricingData[provider].importRates : this.pricingData[provider].exportRates;
        
        if (rates.length === 0) {
            return 0;
        }

        for (const [start, end, price] of rates) {
            if (start <= end) {
                if (start <= time && time < end) return price;
            } else {
                if (start <= time || time < end) return price;
            }
        }
        console.log(`No price found for ${provider} at ${time}`);
        return null;
    }

    calculateExportReduction(exportData, provider) {
        let reduction = 0;
        for (const [timestamp, exportValue] of exportData) {
            const price = this.getPriceForTimestamp(provider, timestamp, 'export');
            reduction += price * exportValue / 2;
        }
        return reduction;
    }

    interpolateData(readingsMap, oldestDate, latestDate) {
         // Generate all possible timestamps in the range at 30-minute intervals
         const allTimestamps = [];
         let currentDate = new Date(oldestDate.getTime());
         while (currentDate <= latestDate) {
             allTimestamps.push(ESBDateUtils.formatDate(currentDate));
             currentDate.setTime(currentDate.getTime() + (30 * 60000));
         }

         // Fill each 30-minute slot...
         let interpolatedData = allTimestamps.map(timestamp => {
             if (readingsMap.has(timestamp)) {
                 return [timestamp, readingsMap.get(timestamp)];
             } else {
                 // Find the same timeslot over the past 14 and next 14 days
                 const sameTimeSlotReadings = [];
                 for (let dayOffset = -14; dayOffset <= 14; dayOffset++) {
                    const date = ESBDateUtils.parseDate(timestamp);
                    date.setDate(date.getDate() + dayOffset);
                    const dayOffsetTimestamp = ESBDateUtils.formatDate(date);
                    //const dayOffsetTimestamp = moment(timestamp, dateFormat).add(dayOffset, 'days').format(dateFormat);
                    if (readingsMap.has(dayOffsetTimestamp)) {
                         sameTimeSlotReadings.push(readingsMap.get(dayOffsetTimestamp));
                    }
                 }
     
                 // Calculate the average if there are any readings for the same timeslot
                 const interpolatedValue = sameTimeSlotReadings.length > 0
                     ? sameTimeSlotReadings.reduce((sum, value) => sum + value, 0) / sameTimeSlotReadings.length
                     : 0; // Let's just set 0 if no data
 
                 console.log("timestamp missing %s . Interpolated value: %s", timestamp, interpolatedValue);
     
                 return [timestamp, interpolatedValue];
             }
         });

         return interpolatedData;
    }

    estimateBillFromData(importData, exportData, interpolate = true) {  
        //Assuming that first row is most recent (latest), last of least recent (oldest)
        let latestDate = ESBDateUtils.parseDate(importData[0][0]);
        let oldestDate = ESBDateUtils.parseDate(importData[importData.length - 1][0]);

        if (oldestDate > latestDate) {
            throw new Error("ESB dataset contains unexpected date ordering.");
        }

        // Map to keep track of actual readings
        const readingsMap = new Map(importData.map(item => [item[0], item[1]]));
    
        // Interpolate missing data as ESB dataset is very often missing slots
        let interpolatedData = interpolate ? this.interpolateData(readingsMap, oldestDate, latestDate) : readingsMap;        

        // Considering that oldestData is the end of the 30 minutes interval
        oldestDate = new Date(oldestDate.getTime() - 30 * 60000); // Subtracting 30 minutes
        
        const numberOfDays = (latestDate - oldestDate) / (1000 * 60 * 60 * 24);
        const ratio = 365 / numberOfDays;

        const bills = {};
        const consumptionCharges = {};
        const consumptionBreakdown = {};

        let totalConsumption = 0;
        let consumptionPerTimeslot = {};

        for (const [timestamp, readValue] of interpolatedData) {
            // Adjust timestamp to represent the beginning of the 30-minute interval
            // ESB timestamps are the end of the period - eg: 16:00 is the consumption from 15:30 to 16:00
            let adjustedTimestamp = new Date(ESBDateUtils.parseDate(timestamp).getTime() - 30 * 60000);

            totalConsumption += readValue / 2;

            let timeslot = ESBDateUtils.formatTime(adjustedTimestamp);
            consumptionPerTimeslot[timeslot] = (consumptionPerTimeslot[timeslot] || 0) + readValue / 2;
        }

        for (const timeslot in consumptionPerTimeslot) {
            consumptionPerTimeslot[timeslot] = consumptionPerTimeslot[timeslot] / totalConsumption;
        }

        for (const provider in this.pricingData) {
            for (const timeslot in consumptionPerTimeslot) {
                // dummy date - TODO: fix
                const timestamp = "01-01-2023 " + timeslot;
                const price = this.getPriceForTimestamp(provider, timestamp);
                const consumptionForTimeslot = consumptionPerTimeslot[timeslot] * totalConsumption * ratio;
                const billedAmount = price * consumptionForTimeslot;
                
                bills[provider] = (bills[provider] || 0) + billedAmount;
                consumptionCharges[provider] = (consumptionCharges[provider] || 0) + billedAmount;
        
                if (!consumptionBreakdown[provider]) {
                    consumptionBreakdown[provider] = {};
                }
        
                consumptionBreakdown[provider][price] = (consumptionBreakdown[provider][price] || 0) + consumptionForTimeslot;
            }
        }
    
        // Add standing charges
        for (const provider in this.standingCharges) {
            bills[provider] = (bills[provider] || 0) + this.standingCharges[provider];
        }

        // Calculate the export reduction for each provider
        const exportReduction = {};
        for (const provider in this.pricingData) {
            exportReduction[provider] = this.calculateExportReduction(exportData, provider) * ratio;
        }

        // Calculate the final bills including export reduction
        for (const provider in bills) {
            bills[provider] = (bills[provider] || 0) - exportReduction[provider];
        }
    
        const responseData = {};
        for (const provider in bills) {
            const breakdown = {
                'total': bills[provider].toFixed(2),
                'consumptionCharge': consumptionCharges[provider].toFixed(2),
                'standingCharge': this.standingCharges[provider].toFixed(2),
                'exportReduction': exportReduction[provider].toFixed(2),
                'breakdown': {}
            };
    
            const totalConsumption = Object.values(consumptionBreakdown[provider]).reduce((a, b) => a + b, 0);
            for (const rate in consumptionBreakdown[provider]) {
                const consumption = consumptionBreakdown[provider][rate];
                const percentage = (consumption / totalConsumption) * 100;
                breakdown['breakdown'][rate] = {
                    'consumption': consumption.toFixed(2),
                    'percentage': percentage.toFixed(2)
                };
            }
    
            responseData[provider] = breakdown;
        }

        return responseData;
    }

    /**
     * Gets the time periods for a given rate and provider.
     * @param {string} provider The name of the provider.
     * @param {number} rate The rate to search for.
     * @returns {Array} An array of time periods (start and end times) for the given rate.
     */
    getTimePeriodsForRate(provider, rate) {
        // Ensure that the provider exists in the pricing data.
        if (!this.pricingData[provider]) {
            console.error(`Provider "${provider}" not found.`);
            return [];
        }

        // Filter the pricing data for the specified rate.
        const timePeriods = this.pricingData[provider].importRates.filter(([,, pricePerKW]) => pricePerKW === rate).map(([startTime, endTime]) => {
            return { startTime, endTime };
        });

        if (timePeriods.length === 0) {
            console.log(`No time periods found for rate ${rate} with provider ${provider}.`);
        }

        return timePeriods;
    }
}

export { EnergyBillEstimator };

