import { EnergyBillEstimator } from '../src/EnergyBillEstimator';
import sampleConsumptionData from './sample-1.csv';
import moment from 'moment';


describe('EnergyBillEstimator', () => {
    let estimator;
    
    const generateDeterministicMockDataCSV = (numIntervals, consumptionValue, startDate, skipInterval = 0, startValueExport = 0, varyConsumption = false ) => {
        let mockData = [];
        let currentValue = consumptionValue;
        let currentValueExport = startValueExport;
        let currentDate = moment(startDate, "DD-MM-YYYY HH:mm");
    
        // Header for the CSV
        mockData.push("MPRN,Meter Serial Number,Read Value,Read Type,Read Date and End Time");
    
        for (let i = 0; i < numIntervals; i++) {
            // Skip intervals based on the skipInterval parameter
            if (skipInterval > 0 && i % skipInterval === 0) {
                currentDate.subtract(30, 'minutes');
                continue; // Skip this iteration
            }


            // Alternate date format as observed in some ESB datasets
            const formattedDate = i % 2 === 0 ? 
                          currentDate.format("DD-MM-YYYY HH:mm"):
                          currentDate.format("DD/MM/YYYY HH:mm");

            // Vary consumption based on time
            if (varyConsumption) {
              const hour = currentDate.hour();
              const minute = currentDate.minute();
              const timeValue = hour * 100 + minute; 
              // Peak hours (08:00 to 16:00)
              // ESB timestamps are the end of the period - eg: 16:00 is the consumption from 15:30 to 16:00
              if (timeValue > 800 && timeValue <= 1600) currentValue = 3;
              // Normal hours (16:00 to 23:00)
              else if (timeValue > 1600 && timeValue <= 2300) currentValue = 2;
              // Off-peak hours (23:00 to 08:00)
              else currentValue = 1;
            }

            const importRow = [
                "dummy",
                "dummy",
                currentValue.toFixed(6),
                "Active Import Interval (kW)",
                formattedDate
            ].join(',');
    
            const exportRow = [
                "dummy",
                "dummy",
                currentValueExport.toFixed(6),
                "Active Export Interval (kW)",
                formattedDate
            ].join(',');
    
            mockData.push(importRow);
            mockData.push(exportRow);
    
            currentValue;
            currentDate.subtract(30, 'minutes');
        }
    
        return mockData.join('\n');
    }

    beforeEach(() => {
        estimator = EnergyBillEstimator.create();
    });

    it('should estimate the bill with the correct structure for each provider', () => {
        const result = estimator.withConsumption(sampleConsumptionData).estimate();

        console.dir(JSON.stringify(result));

        const twoDecimalRegex = /^-?\d+(\.\d{1,2})?$/; // This will match numbers like: 123, 123.4, 123.45

        // Expected structure:
        // {
        //   total: 'xx.xx',
        //   consumptionCharge: 'xx.xx',
        //   standingCharge: 'xx.xx',
        //   breakdown: {
        //     'variable-rate1': { consumption: 'xx.xx', percentage: 'xx.xx' },
        //     'variable-rate2': { consumption: 'xx.xx', percentage: 'xx.xx' },
        //     ... (can have multiple rates)
        //   }
        // }

        // Loop through each provider in the result
        Object.keys(result).forEach(providerKey => {
            const providerEstimate = result[providerKey];

            expect(providerEstimate).toEqual(expect.objectContaining({
                total: expect.stringMatching(twoDecimalRegex),
                consumptionCharge: expect.stringMatching(twoDecimalRegex),
                standingCharge: expect.stringMatching(twoDecimalRegex),
                exportReduction: expect.stringMatching(twoDecimalRegex),
                breakdown: expect.any(Object)
            }));

            // Now loop over the keys in breakdown and verify each one's structure
            Object.keys(providerEstimate.breakdown).forEach(key => {
                expect(providerEstimate.breakdown[key]).toEqual(expect.objectContaining({
                    consumption: expect.stringMatching(twoDecimalRegex),
                    percentage: expect.stringMatching(twoDecimalRegex)
                }));
            });
        });
    });


    it('should estimate the bill correctly', () => {   

        // one day of data (48 intervals of 30 minutes)
        // 1 kw readings every 30 minutes (0.5 kwh)
        const mockedConsumptionData = generateDeterministicMockDataCSV(48, 1, "10-11-2023 00:00"); 

        const mockPricingData = `
providers:
  - name: Mock Plan
    pricings:
      - start_date: null
        end_date: null
        standing_charge: 100
        import_rates:
          - start_time: 08:00
            end_time: 23:00
            price_per_kwh: 0.1
          - start_time: 23:00
            end_time: 02:00
            price_per_kwh: 0.1
          - start_time: 02:00
            end_time: 04:00
            price_per_kwh: 0.1
          - start_time: 04:00
            end_time: 08:00
            price_per_kwh: 0.1
        export_rates: []
`;

        const estimator = EnergyBillEstimator.create(mockPricingData);

        const result = estimator.withConsumption(mockedConsumptionData).estimate();

        const expectedAnnualConsumptionCharge = 1 * 24 * 365 * 0.1;
        const expectedTotalCharge = expectedAnnualConsumptionCharge + 100;

        expect(Number(result['Mock Plan'].total)).toBeCloseTo(expectedTotalCharge);
        expect(Number(result['Mock Plan'].consumptionCharge)).toBeCloseTo(expectedAnnualConsumptionCharge);        
    });

    it('should correctly estimate support over one year of data', () => {   

        // 2 years of data (35040 intervals of 30 minutes)
        // 1 kw readings every 30 minutes (0.5 kwh)
        const mockedConsumptionData = generateDeterministicMockDataCSV(35040, 1, "10-11-2023 00:00"); 

        const mockPricingData = `
providers:
  - name: Mock Plan
    pricings:
      - start_date: null
        end_date: null
        standing_charge: 100
        import_rates:
          - start_time: 08:00
            end_time: 23:00
            price_per_kwh: 0.1
          - start_time: 23:00
            end_time: 02:00
            price_per_kwh: 0.1
          - start_time: 02:00
            end_time: 04:00
            price_per_kwh: 0.1
          - start_time: 04:00
            end_time: 08:00
            price_per_kwh: 0.1
        export_rates: []
`;

        const estimator = EnergyBillEstimator.create(mockPricingData);

        const result = estimator.withConsumption(mockedConsumptionData).estimate();

        const expectedAnnualConsumptionCharge = 1 * 24 * 365 * 0.1;
        const expectedTotalCharge = expectedAnnualConsumptionCharge + 100;

        expect(Number(result['Mock Plan'].total)).toBeCloseTo(expectedTotalCharge);
        expect(Number(result['Mock Plan'].consumptionCharge)).toBeCloseTo(expectedAnnualConsumptionCharge);        
    });

    it('should correctly estimate with one single interval', () => {
        const mockedConsumptionData = generateDeterministicMockDataCSV(1, 1, "10-11-2023 00:00"); 

        const mockPricingData = `
providers:
  - name: Mock Plan
    pricings:
      - start_date: null
        end_date: null
        standing_charge: 100
        import_rates:
          - start_time: 08:00
            end_time: 23:00
            price_per_kwh: 0.1
          - start_time: 23:00
            end_time: 02:00
            price_per_kwh: 0.1
          - start_time: 02:00
            end_time: 04:00
            price_per_kwh: 0.1
          - start_time: 04:00
            end_time: 08:00
            price_per_kwh: 0.1
        export_rates: []
`;

        const estimator = EnergyBillEstimator.create(mockPricingData);

        const result = estimator.withConsumption(mockedConsumptionData).estimate();

        const expectedAnnualConsumptionCharge = 1 * 24 * 365 * 0.1;
        const expectedTotalCharge = expectedAnnualConsumptionCharge + 100;

        expect(Number(result['Mock Plan'].total)).toBeCloseTo(expectedTotalCharge);
        expect(Number(result['Mock Plan'].consumptionCharge)).toBeCloseTo(expectedAnnualConsumptionCharge);        
    });


    it('should correctly interpolate missing consumption data', () => {          
        // 1 kw readings every 30 minutes (0.5 kwh)
        // every 20 reading is missing from data set
        const mockedConsumptionData = generateDeterministicMockDataCSV(100, 1, "10-11-2023 00:00", 20); 

        const mockPricingData = `
providers:
  - name: Mock Plan
    pricings:
      - start_date: null
        end_date: null
        standing_charge: 100
        import_rates:
          - start_time: 08:00
            end_time: 23:00
            price_per_kwh: 0.1
          - start_time: 23:00
            end_time: 02:00
            price_per_kwh: 0.1
          - start_time: 02:00
            end_time: 04:00
            price_per_kwh: 0.1
          - start_time: 04:00
            end_time: 08:00
            price_per_kwh: 0.1
        export_rates: []
`;

        const estimator = EnergyBillEstimator.create(mockPricingData);

        const result = estimator.withConsumption(mockedConsumptionData).estimate();

        const expectedAnnualConsumptionCharge = 1 * 24 * 365 * 0.1;
        const expectedTotalCharge = expectedAnnualConsumptionCharge + 100;

        expect(Number(result['Mock Plan'].total)).toBeCloseTo(expectedTotalCharge);
        expect(Number(result['Mock Plan'].consumptionCharge)).toBeCloseTo(expectedAnnualConsumptionCharge);        
    });

    it('should correctly take into account export data', () => {          
      // 1 kw readings every 30 minutes (0.5 kwh)
      // 1 kw generation every 30 minutes
      // 100 intervals of 30 minutes
      const mockedConsumptionData = generateDeterministicMockDataCSV(100, 1, "10-11-2023 00:00", 0, 1); 

      const mockPricingData = `
providers:
- name: Mock Plan
  pricings:
    - start_date: null
      end_date: null
      standing_charge: 100
      import_rates:
        - start_time: 08:00
          end_time: 23:00
          price_per_kwh: 0.1
        - start_time: 23:00
          end_time: 02:00
          price_per_kwh: 0.1
        - start_time: 02:00
          end_time: 04:00
          price_per_kwh: 0.1
        - start_time: 04:00
          end_time: 08:00
          price_per_kwh: 0.1
      export_rates:
        - start_time: 00:00
          end_time: 24:00
          price_per_kwh: 0.1
`;

      const estimator = EnergyBillEstimator.create(mockPricingData);

      const result = estimator.withConsumption(mockedConsumptionData).estimate();

      const expectedAnnualConsumptionCharge = 1 * 24 * 365 * 0.1;
      const expectedReduction = expectedAnnualConsumptionCharge; // imports == exports at same rate to simplify

      const expectedTotalCharge = 100; // just the standing charge

      expect(Number(result['Mock Plan'].total)).toBeCloseTo(expectedTotalCharge);
      expect(Number(result['Mock Plan'].exportReduction)).toBeCloseTo(expectedReduction);
      expect(Number(result['Mock Plan'].consumptionCharge)).toBeCloseTo(expectedAnnualConsumptionCharge);        
  });


  it('should correctly estimate the bill with variable pricing and consumption throughout the day', () => {

    // Mock data with varied consumption values throughout the day (48 intervals of 30 minutes)
    // Consumption varies: 1 kW during off-peak hours, 2 kW during normal hours, and 3 kW during peak hours
    const mockedConsumptionData = generateDeterministicMockDataCSV(48, 0, "10-11-2023 00:00", 0, 0, true);

    // Mock pricing data with variable pricing throughout the day
    const mockPricingData = `
providers:
  - name: Mock Variable Plan
    pricings:
      - start_date: null
        end_date: null
        standing_charge: 100
        import_rates:
          - start_time: 08:00
            end_time: 16:00
            price_per_kwh: 0.15  // Higher price during peak hours (08:00 to 16:00)
          - start_time: 16:00
            end_time: 23:00
            price_per_kwh: 0.1   // Normal price (16:00 to 23:00)
          - start_time: 23:00
            end_time: 08:00
            price_per_kwh: 0.05  // Lower price during off-peak hours (23:00 to 08:00)
        export_rates: []
`;

    const estimator = EnergyBillEstimator.create(mockPricingData);

    const result = estimator.withConsumption(mockedConsumptionData).estimate();

    // Calculate expected charges for different time periods with varying consumption
    const peakHoursCharge = 8 * 3 * 0.15;  // 8 hours of peak time at 3 kW
    const normalHoursCharge = 7 * 2 * 0.1; // 7 hours of normal time at 2 kW
    const offPeakHoursCharge = 9 * 1 * 0.05; // 9 hours of off-peak time at 1 kW

    const expectedDailyCharge = peakHoursCharge + normalHoursCharge + offPeakHoursCharge;
    const expectedAnnualConsumptionCharge = expectedDailyCharge * 365;
    const expectedTotalCharge = expectedAnnualConsumptionCharge + 100;

    expect(Number(result['Mock Variable Plan'].total)).toBeCloseTo(expectedTotalCharge);
    expect(Number(result['Mock Variable Plan'].consumptionCharge)).toBeCloseTo(expectedAnnualConsumptionCharge);
  });


});
