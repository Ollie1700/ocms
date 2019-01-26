var express = require('express');
var app = express();
var bodyParser = require('body-parser');

var port = process.env.PORT || 8080;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true,
}));

app.use('/api', require('./core/api.js'));

app.get('/bootstrap.js', (req, res) => res.sendFile(__dirname + '/core/bootstrap.js'));

app.get('/service-worker.js', (req, res) => res.sendFile(__dirname + '/core/service-worker.js'));

app.use(express.static('public'));

app.get('*', (req, res) => {
    res.sendFile(__dirname + '/core/bootstrap.html');
});

app.listen(port);
console.log('Server is running...');
