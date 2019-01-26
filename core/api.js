// Express
const express = require('express');
const router = express.Router();
// Webpack
const webpack = require('webpack');
const MemoryFS = require('memory-fs');

// File System
const fs = require('fs');

// MD5
const md5 = require('md5');

// Turndown (HTML to markdown converter)
const TurndownService = require('turndown');
const turndown = new TurndownService();

// Showdown (markdown parser)
const showdown = require('showdown');
const mdConverter = new showdown.Converter();

// Globals
const VERSION = (() => {
    // Concat all files from 'core' to get the hash (version) of the system
    var concatData = '', hash;
    fs.readdirSync(__dirname).forEach((file) => {
        concatData += fs.readFileSync(__dirname + '\\' + file);
    });
    hash = md5(concatData);
    console.log('Core version: ' + hash);
    return hash;
})();

const contentRoot = __dirname + '/../content/root';

// Routes
router.get('/version', (req, res) => {
    res.send(VERSION);
});

router.get('/download', (req, res) => {
    // The webpack compiler will minify and concatenate all the files we need
    const compiler = webpack({
        entry: __dirname + '/engine.js',
        mode: 'development',
        output: {
            path: '/',
            filename: 'bundle.js',
        },
        module: {
            rules: [
                {
                    test: /\.html$/,
                    loaders: ['to-string-loader', 'html-loader']
                },
                {
                    test: /\.md$/,
                    loaders: ['to-string-loader', 'html-loader', 'markdown-loader']
                }
            ],
        }
    });

    // We're changing the default output to an in-memory file system
    // since we only need it as a string, we don't need to create a seperate
    // output file.
    compiler.outputFileSystem = new MemoryFS();

    // Run the compiler, check for errors then send the webpacked code back
    compiler.run((err, stats) => {
        if (err) {
            console.error(err.stack || err);
            if (err.details) {
                console.error(err.details);
            }
            res.status(500).send(err.details);
            return;
        }

        const info = stats.toJson();

        if (stats.hasErrors()) {
            console.error(info.errors);
        }

        if (stats.hasWarnings()) {
            console.warn(info.warnings);
        }

        // Done processing
        var theOutput = compiler.outputFileSystem.data['bundle.js'].toString();
        res.send(theOutput);
    });
});

router.get('/page/:path*?', (req, res) => {
    // The path to access
    const path = req.params.path ? '/' + req.params.path.replace(/\./g, '/') : '';

    /**
     * ------------------
     * TEMPLATE HIERARCHY
     * ------------------
     * In order of priority:
     * 1. /content/root/${path}.html
     * 2. /content/root/${path}.md
     * 3. /content/root/${path}/index.html
     * 4. /content/root/${path}/index.md
     */

    const templateHierarchy = [
        `${contentRoot}${path}/index.html`,
        `${contentRoot}${path}/index.md`,
        `${contentRoot}${path}.html`,
        `${contentRoot}${path}.md`,
    ];

    const getTemplate = (level = 0) => {
        // If the path was the root, and we already checked for index.html and index.md, end here
        // OR
        // If there are no more templates in the hierarchy
        if((level >= 2 && path == '') ||
           (level >= templateHierarchy.length)) {
            res.status(404).send('Template not found');
            return;
        }

        // Try and find the file
        fs.readFile(templateHierarchy[level], (err, data) => {
            // Move down the hierarchy if file not found
            if(err) {
                getTemplate(level + 1);
                return;
            }
            // Found the template!
            var template = `${data}`;
            // If it's MD parse it
            if(templateHierarchy[level].endsWith('.md')) {
                template = mdConverter.makeHtml(template);
            }

            // If the request needs the hash not the content
            if(req.header('X-Hash-Only') === 'true') {
                res.send(md5(template));
            }
            // Otherwise send the actual content
            else {
                res.setHeader('Content-Type', 'application/json');
                res.json({
                    target: templateHierarchy[level].split(contentRoot)[1],
                    template: template,
                });
            }
            return;
        });
    };
    // Start recursive function
    getTemplate();
});

router.post('/page/:path*?', (req, res) => {
    const target = req.body.target;
    var newContent = req.body.content;

    if(target.endsWith('.md')) {
        newContent = turndown.turndown(newContent);
    }

    fs.writeFileSync(contentRoot + target, newContent);
    res.status(204).end();
});

// Exports
module.exports = router;
