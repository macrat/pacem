var express = require("express");
var app = express();
app.disable("x-powerd-by");

require("./router.js")(express, app);

var server = app.listen(8000, function(){
	console.log("started pacem server");
});

require("./api.js")(server);
