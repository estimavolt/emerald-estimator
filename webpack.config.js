const path = require('path');
 

module.exports = {
  entry: './src/EnergyBillEstimator.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'EmeraldEstimator.bundle.js',
    library: 'EmeraldEstimator',
    libraryTarget: 'umd',
    globalObject: 'this',
    umdNamedDefine: true
  },  
  mode: "development",
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: 'babel-loader'
      },
      {
        test: /\.csv$/,
        use: 'raw-loader',
      },
      {
        test: /\.yaml$/,
        use: 'raw-loader',
      },
    ]
  }
};