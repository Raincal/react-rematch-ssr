const webpack = require('webpack')
const merge = require('webpack-merge')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const path = require('path')
const UglifyjsWebpackPlugin = require('uglifyjs-webpack-plugin')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const ReactLoadablePlugin = require('react-loadable/webpack').ReactLoadablePlugin
const OptimizeCssAssetsPlugin = require('optimize-css-assets-webpack-plugin')
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin
const AutoDllPlugin = require('autodll-webpack-plugin')
const CleanWebpackPlugin = require('clean-webpack-plugin')
const hash = require('hash-sum')
const base = require('./webpack.conf.base')
const config = require('./config')
const modules = require('./modules')

const r = dir => path.resolve(__dirname, '..', dir)
const seen = new Set()
const nameLength = 4

const cssLoaders = (modulesCss) => {
  // 处理项目目录内的css
  const projectCssLoader = {
    loader: 'css-loader',
    options: {
      modules: config.common.cssModules,
      localIdentName: '[local]_[hash:base64:5]',
      sourceMap: true,
      importLoaders: 2,
      camelCase: true
    }
  }

  // 处理node_modules目录内的css
  const modulesCssLoader = {
    loader: 'css-loader',
    options: {
      sourceMap: true,
      importLoaders: 2
    }
  }

  return [
    MiniCssExtractPlugin.loader,
    modulesCss ? modulesCssLoader : projectCssLoader,
    {
      loader: 'postcss-loader',
      options: {
        ident: 'postcss',
        plugins: () => [
          require('postcss-flexbugs-fixes'),
          require('autoprefixer')({
            browsers: [
              '>1%',
              'last 4 versions',
              'Firefox ESR',
              'not ie < 9'
            ],
            flexbox: 'no-2009',
            remove: false
          })
        ],
        sourceMap: true
      }
    },
    {
      loader: 'sass-loader',
      options: {
        sourceMap: true,
        import: []
      }
    }
  ]
}

module.exports = merge(base, {
  mode: 'production',
  devtool: '#source-map',
  performance: {
    hints: 'warning',
    maxAssetSize: 300000,
    assetFilter: (assetFilename) => {
      return assetFilename.endsWith('.js')
    }
  },
  entry: {
    app: './src/entry-client.js'
  },
  output: {
    filename: 'static/js/[name].[chunkhash:8].js',
    path: r('dist'),
    publicPath: config.prod.publicPath,
    chunkFilename: 'static/js/[name].[chunkhash:8].js'
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        use: {
          loader: 'babel-loader',
          options: {
            cacheDirectory: true
          }
        },
        include: r('src')
      },
      {
        test: /\.(css|scss)$/,
        oneOf: [
          {
            resource: /node_modules/,
            use: cssLoaders(true)
          },
          {
            use: cssLoaders(false)
          }
        ]
      }
    ]
  },
  optimization: {
    runtimeChunk: {
      name: 'manifest'
    },
    splitChunks: {
      cacheGroups: {
        vender: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vender',
          priority: -10,
          chunks: 'all'
        }
      }
    },
    minimizer: [
      new UglifyjsWebpackPlugin({
        uglifyOptions: {
          output: {
            comments: false,
            beautify: false
          },
          compress: {
            warnings: false
          }
        },
        cache: true,
        parallel: true,
        sourceMap: true
      }),
      new OptimizeCssAssetsPlugin({
        cssProcessorOptions: {
          parser: require('postcss-safe-parser'),
          map: {
            inline: false
          }
        }
      })
    ]
  },
  plugins: [
    new CleanWebpackPlugin(['dist'], {
      root: r('.'),
      verbose: true
    }),
    new HtmlWebpackPlugin({
      filename: 'server.ejs',
      template: '!!ejs-compiled-loader!' + r('public/server.template.ejs'),
      inject: true,
      minify: {
        removeComments: true,
        collapseWhitespace: true,
        removeAttributeQuotes: true
      },
      chunksSortMode: 'dependency'
    }),
    new AutoDllPlugin({
      inject: true,
      filename: 'dll.[name].[chunkhash:8].js',
      entry: {
        vendor: modules
      }
    }),
    new webpack.DefinePlugin({
      'process.env': {
        isClient: 'true',
        isServer: 'false'
      }
    }),
    new webpack.HashedModuleIdsPlugin(),
    new webpack.optimize.ModuleConcatenationPlugin(),
    new MiniCssExtractPlugin({
      filename: 'static/css/[name].[contenthash:8].css',
      chunkFilename: 'static/css/[name].[contenthash:8].css'
    }),
    new CopyWebpackPlugin([
      { from: r('public'), to: '', ignore: ['index.template.html', 'server.template.ejs'] }
    ]),
    new ReactLoadablePlugin({
      filename: './dist/react-loadable.json'
    }),
    new webpack.NamedChunksPlugin(chunk => {
      if (chunk.name) {
        return chunk.name
      }

      const modules = Array.from(chunk.modulesIterable)
      if (modules.length > 1) {
        const joinedHash = hash(modules.map(m => m.id).join('-'))
        let len = nameLength
        while (seen.has(joinedHash.substr(0, len))) len++
        seen.add(joinedHash.substr(0, len))
        return `chunk-${joinedHash.substr(0, len)}`
      } else {
        return modules[0].id
      }
    }),
    new BundleAnalyzerPlugin({
      analyzerMode: 'static',
      generateStatsFile: true
    })
  ]
})
