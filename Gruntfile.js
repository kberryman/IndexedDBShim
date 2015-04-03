/* global module:false */
module.exports = function(grunt) {
	var srcFiles = ['src/Init.js', 'src/util.js', 'src/Sca.js', 'src/Key.js', 'src/Event.js', 'src/DOMException.js', 'src/IDBRequest.js', 'src/IDBKeyRange.js', 'src/IDBCursor.js', 'src/IDBIndex.js', 'src/IDBObjectStore.js', 'src/IDBTransaction.js', 'src/IDBDatabase.js', 'src/IDBFactory.js', 'src/globalVars.js'];
	var saucekey = null;
	if (typeof process.env.saucekey !== "undefined") {
		saucekey = process.env.SAUCE_ACCESS_KEY;
	}

  var os=require('os');
  var ifaces=os.networkInterfaces();
  var lookupIpAddress = null;
  for (var dev in ifaces) {
    if(dev != "en1" && dev != "en0") {
      continue;
    }
    ifaces[dev].forEach(function(details){
      if (details.family=='IPv4') {
        lookupIpAddress = details.address;
      }
    });
  }

  //If an IP Address is passed
  //we're going to use the ip/host from the param
  //passed over the command line
  //over the ip addressed that was looked up
  var ipAddress = grunt.option('host') || lookupIpAddress || 'localhost';

	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		concat: {
			dist: {
				src: srcFiles,
				dest: 'dist/<%= pkg.name%>.js'
			}
		},
		uglify: {
			options: {
				banner: '/*! <%= pkg.name %> - v<%= pkg.version %> - ' + '<%= grunt.template.today("yyyy-mm-dd") %> */\n',
				sourceMap: 'dist/<%=pkg.name%>.min.map',
				sourceMapRoot: 'http://nparashuram.com/IndexedDBShim/',
				sourceMappingURL: 'http://nparashuram.com/IndexedDBShim/dist/<%=pkg.name%>.min.map'
			},
			all: {
				src: srcFiles,
				dest: 'dist/<%=pkg.name%>.min.js'
			}
		},
    connect: {
      options: {
        port: 9000,
          // Change this to '0.0.0.0' to access the server from outside.
          hostname: ipAddress,
          livereload: 35729
      },
      livereload: {
        options: {
          open: true,
            base: '.'
        }
      },
      test: {
        options: {
          port: 9001,
            base: [
            '.tmp',
            'test',
          ]
        }
      },
      dist: {
        options: {

        }
      }
    },
		qunit: {
			all: {
				options: {
					urls: ['http://localhost:9999/test/index.html']
				}
			}
		},
    clean: {
      dist: {
        files: [{
          dot: true,
          src: [
            '.tmp',
          ]
        }]
      },
      server: '.tmp'
    },
		'saucelabs-qunit': {
			all: {
				options: {
					username: 'indexeddbshim',
					key: saucekey,
					tags: ['master'],
					urls: ['http://127.0.0.1:9999/test/index.html'],
					browsers: [{
							browserName: 'safari',
							platform: 'Windows 2008',
							version: '5'
						}, {
							browserName: 'opera',
							version: '12'
						}
					]
				}
			}
		},

		jshint: {
			files: ['src/**/*.js'],
			options: {
				jshintrc: '.jshintrc'
			}
		},
		watch: {
			dev: {
				files: ["src/*"],
				tasks: ["jshint", "concat"]
			},
      livereload: {
        options: {
          livereload: '<%= connect.options.livereload %>'
        },
        files: [
          'src/**/*.js',
          'test/*'
        ]
      }
		}
	});

	for (var key in grunt.file.readJSON('package.json').devDependencies) {
		if (key !== 'grunt' && key.indexOf('grunt') === 0) grunt.loadNpmTasks(key);
	}

  grunt.registerTask('server', function (target) {
    grunt.task.run([
      'build',
      'clean:server',
      'connect:livereload',
      'watch'
    ]);
  });

	grunt.registerTask('build', ['jshint', 'concat', 'uglify']);
	var testJobs = ["build", "connect"];
	if (saucekey !== null) {
		testJobs.push("saucelabs-qunit");
	} else {
		testJobs.push("qunit");
	}

	grunt.registerTask('test', testJobs);

	grunt.registerTask('default', 'build');
	grunt.registerTask('dev', ['build', 'connect', 'watch']);
};
