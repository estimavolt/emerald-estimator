# Emerald Estimator

## Introduction

Emerald Estimator is an open-source JavaScript library for estimating energy bills in the Republic of Ireland. It reads smart meter data provided by the ESB network and calculates energy costs based on consumption and exports.

## Features

- Parses energy consumption data from files.
- Estimates energy bills using import and export readings.
- Supports multiple energy providers with customizable rates.
- Detailed consumption and cost breakdown.
- Interpolates missing data for accuracy.

## Installation

### Installing Emerald Estimator in Node.js

For Node.js environments:

```bash
npm install emerald-estimator
```

Prerequesites: Node.js version 18 or higher.

### Installing in browser environments

Include the following script tag in your HTML file to use Emerald Estimator directly in the browser from the unpkg CDN. This will make EmeraldEstimator available globally.

```html
<script src="https://unpkg.com/emerald-estimator@latest"></script>
```

Note: Replace @latest in the URL with the specific version number if you want to use a particular version of the emerald-estimator library. The @latest tag will always pull the most recent version.

## Usage

### Initialization in Node.js

```javascript
import { EnergyBillEstimator } from 'emerald-estimator';

const estimator = EnergyBillEstimator.create();
```

### Initialization in Browser

In the browser, you don't need to import the module as it's included globally via the script tag.

```html
<script>
    const estimator = EmeraldEstimator.create();
</script>
```

### Loading Consumption Data

```javascript
const fileContent = fs.readFileSync(filePath, 'utf8'); // or any other way to get the content of the file
estimator.withConsumption(fileContent);
```

```fileContent``` is the content of the HDF file (csv file) obtained from the ESB website. See [here](https://www.esbnetworks.ie/help-centre/help-faq/your-energy-consumption/what-is-a-hdf-file) for details.

### Estimating Bills

```javascript
const estimatedBills = estimator.estimate();
```

The `estimate()` method returns an object containing detailed estimation results. Here's a breakdown of its structure:

- **Provider Names**: Each key in the object represents the name of an energy provider.
- **Estimation Details**: For each electricity supply plan, the object includes:
    - `total`: The total estimated bill amount.
    - `consumptionCharge`: The total charge based on energy consumption.
    - `standingCharge`: The fixed daily charge from the provider.
    - `exportReduction`: The amount reduced from the bill due to energy export.
    - `breakdown`: An object detailing the consumption breakdown by rate. This includes:
        - `consumption`: The amount of energy consumed at each rate.
        - `percentage`: The percentage of total consumption at each rate.

**Example Output**

```json
{
   "Electric Ireland Home Electric+ Night Boost":{
      "total":"2294.81",
      "consumptionCharge":"1937.62",
      "standingCharge":"357.19",
      "exportReduction":"0.00",
      "breakdown":{
         "0.1939":{
            "consumption":"1435.27",
            "percentage":"20.91"
         },
         "0.1138":{
            "consumption":"1698.63",
            "percentage":"24.75"
         },
         "0.3931":{
            "consumption":"3729.38",
            "percentage":"54.34"
         }
      }
   },
   "Plan2": {
    // Similar structure for other providers
  }
}
```

## Build

To build Emerald Estimator for use in your project, follow these steps:

1. Clone or download the repository to your local machine.
2. Navigate to the root directory of the project.
3. Run the following command to build the project:

   ```bash
   npm run build
   ```

This process compiles the source code into a production-ready bundle located in the dist directory, named EmeraldEstimator.bundle.js. You can then include this bundle in your project as needed.

The bundle can be integrated into various project types, including:
- Node.js applications: Can be required as a module.
- Web applications: Can be included as a script in HTML, accessible via the global variable `EmeraldEstimator`.
- Modern JavaScript frameworks: Compatible with frameworks like React, Vue.js, and Angular.

## Test

- Build: `npm run build`
- Test: `npm run test`
- Clear Jest Cache: `npm run clear-jest-cache`
- Test with Profiling: `npm run test:profile`

The library is exposed as `EmeraldEstimator` and is compatible with UMD (Universal Module Definition).

## Dependencies

- `js-yaml`
- `papaparse`

## Contributing

Contributions are welcome. Please submit pull requests, open issues, or suggest features.

## License

Licensed under the GNU Affero General Public License (AGPL).



