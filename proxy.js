var http = require('http');
var https = require('https');

http.createServer(function (req, resp) {
    var h = req.headers;
    h.host = "lni9xwzhc5.execute-api.us-east-1.amazonaws.com";
    var req2 = https.request({ host: h.host, port: 443, path: req.url, method: req.method, headers: h }, function (resp2) {
        resp.writeHead(resp2.statusCode, resp2.headers);
        resp2.on('data', function (d) { resp.write(d); });
        resp2.on('end', function () { resp.end(); });
    });
    req.on('data', function (d) { req2.write(d); });
    req.on('end', function () { req2.end(); });
}).listen(9999, "127.0.0.1");
console.log('Server running at http://127.0.0.1:9999/');