module.exports = function(express, app){
	app.use("/", express.static(__dirname + "/../client"));
};
