const libraryName = 'CoronaBundle'
const outputFile = `${libraryName}.js`

module.exports = {
  // Examine utility files with prototype definitions first
  entry: ['./src/Utils.js',
		  './src/D3Utils.js',
   		  './corona-app.js',],
  target: 'web',
  devtool: 'source-map',
  output: {
    path: `${__dirname}/lib`,
    filename: outputFile,
    library: libraryName,
    libraryTarget: 'umd',
    umdNamedDefine: true,
  },
  mode: 'production',
  watch: true,
}
