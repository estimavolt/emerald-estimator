import yaml from 'js-yaml';
import { EnergyBillEstimator } from '../src/EnergyBillEstimator';
import providerPricing from '../data/provider_pricing.yaml';

// Minutes since midnight for "HH:MM" ("24:00" -> 1440)
const toMinutes = time => {
    const [hours, minutes] = String(time).split(':').map(Number);
    return hours * 60 + minutes;
};

// Returns how many rates cover each 30-minute slot of the day
const slotCoverage = rates => {
    const coverage = new Array(48).fill(0);
    for (const rate of rates) {
        const start = toMinutes(rate.start_time);
        const end = toMinutes(rate.end_time);
        for (let slot = 0; slot < 48; slot++) {
            const minute = slot * 30;
            const covered = start <= end
                ? start <= minute && minute < end
                : start <= minute || minute < end;
            if (covered) coverage[slot]++;
        }
    }
    return coverage;
};

describe('provider_pricing.yaml', () => {
    const { providers } = yaml.load(providerPricing);

    it('has unique provider names', () => {
        const names = providers.map(provider => provider.name.trim());
        expect(new Set(names).size).toBe(names.length);
    });

    it('has a pricing in effect today for every provider', () => {
        const estimator = EnergyBillEstimator.create();
        const names = Object.keys(estimator.pricingData);
        expect(names).toHaveLength(providers.length);
    });

    providers.forEach(provider => {
        describe(provider.name.trim(), () => {
            provider.pricings.forEach(pricing => {
                const label = `pricing from ${pricing.start_date ? pricing.start_date.toISOString().slice(0, 10) : 'start'}`;

                it(`${label}: import rates cover every half hour exactly once`, () => {
                    expect(slotCoverage(pricing.import_rates)).toEqual(new Array(48).fill(1));
                });

                it(`${label}: export rates cover every half hour exactly once`, () => {
                    if (pricing.export_rates && pricing.export_rates.length > 0) {
                        expect(slotCoverage(pricing.export_rates)).toEqual(new Array(48).fill(1));
                    }
                });

                it(`${label}: has plausible prices (EUR/kWh, EUR/year)`, () => {
                    expect(pricing.standing_charge).toBeGreaterThan(0);
                    expect(pricing.standing_charge).toBeLessThan(1000);
                    [...pricing.import_rates, ...(pricing.export_rates || [])].forEach(rate => {
                        expect(rate.price_per_kwh).toBeGreaterThanOrEqual(0);
                        expect(rate.price_per_kwh).toBeLessThan(1);
                    });
                });
            });
        });
    });
});

describe('pricing period selection', () => {
    const pricingWithPeriods = `
providers:
  - name: Dated Plan
    pricings:
      - start_date: 2024-01-01
        end_date: 2024-06-30
        standing_charge: 100
        import_rates:
          - start_time: 00:00
            end_time: 24:00
            price_per_kwh: 0.1
      - start_date: 2024-07-01
        end_date: null
        standing_charge: 200
        import_rates:
          - start_time: 00:00
            end_time: 24:00
            price_per_kwh: 0.2
  - name: Withdrawn Plan
    pricings:
      - start_date: 2024-01-01
        end_date: 2024-03-31
        standing_charge: 300
        import_rates:
          - start_time: 00:00
            end_time: 24:00
            price_per_kwh: 0.3
`;

    it('uses the pricing in effect on the asOf date', () => {
        const before = EnergyBillEstimator.create(pricingWithPeriods, { asOf: new Date(2024, 5, 30) });
        expect(before.standingCharges['Dated Plan']).toBe(100);
        expect(before.pricingData['Dated Plan'].importRates[0][2]).toBe(0.1);

        const after = EnergyBillEstimator.create(pricingWithPeriods, { asOf: new Date(2024, 6, 1) });
        expect(after.standingCharges['Dated Plan']).toBe(200);
        expect(after.pricingData['Dated Plan'].importRates[0][2]).toBe(0.2);
    });

    it('drops plans with no pricing in effect', () => {
        const estimator = EnergyBillEstimator.create(pricingWithPeriods, { asOf: new Date(2024, 3, 1) });
        expect(Object.keys(estimator.pricingData)).toEqual(['Dated Plan']);
    });

    it('drops plans whose pricing has not started yet', () => {
        const estimator = EnergyBillEstimator.create(pricingWithPeriods, { asOf: new Date(2023, 11, 31) });
        expect(Object.keys(estimator.pricingData)).toEqual([]);
    });
});
