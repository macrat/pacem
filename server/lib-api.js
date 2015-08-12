// connection server


var g_socket;
var g_userId = 0;
// 位置情報
var g_lat, g_lng;


function InitSocket(socket, connectCallback, disconnectCallback)
{
	g_socket = socket;
	//サーバから受け取るイベント
	g_socket.on("connect", connectCallback);
	g_socket.on("disconnect", disconnectCallback);
}


function login(callback){
	// login.
	//
	// callback -- callback function.
	//  err -- error message string. if success, this is null.

	// debug: do something here
	callback(null);
}


function getUserInfo(){
	// get user information.
	//
	// resunt: user information.

	// debug: do something here
	return { ID: 123, name: "username" };
}


function updateUserInfo(data, callback){
	// update user information.
	//
	// data -- new user information.
	//  name -- new user name.
	// callback -- callback function.
	//  err -- error message string. if success, this is null.


	g_userId = data.userId;
	g_lat = data.lat;
	g_lng = data.lng;


	// debug: do something here
	callback(null);
}


function getNearBeacons(callback){
	// get near beacons list.
	//
	// callaback -- callback function.
	//  beacons -- list of beacon information.
	//   id -- beacon's id
	//   place -- [latitude, longitude, altitude]
	//   owner -- beacon owner name.
	//   date -- beacon established date time.
	//  err -- error message string. if success, this is null.


	g_socket.emit("get", { lat : g_lat, lng : g_lng });
	g_socket.on("get-ret", function (data) {
		callback(data.beacons, null);
	});


	// debug: do something here
/*	callback([
		{
			id: 0,
			place: [100, 200, 300],
			owner: "owner",
			date: (new Date())
		},
		{
			id: 1,
			place: [300, 200, 100],
			owner: "name",
			date: (new Date())
		}
	], null);*/
}


function getMyBeacons(callback){
	// get my beacons list.
	//
	// callback -- callback function. parameters is same as getNearBeacons.

	// debug: do something here
	callback([
		{
			id: 0,
			place: [100, 200, 300],
			owner: "owner",
			date: (new Date())
		},
		{
			id: 1,
			place: [300, 200, 100],
			owner: "name",
			date: (new Date())
		}
	], null);
}


function putBeacon(pType, callback){
	// put beacon to now place.
	//
	// type -- beacon type ID.
	// callback -- callback function..
	//  err -- error message string. if success, this is null.


	g_socket.emit("set", { userId : g_userId, type : pType, lat : g_lat, lng : g_lng });


	// debug: do something here
	callback(null);
}


function getBeacon(id, callback){
	// get particular beacon with beaconID.
	//
	// id -- beacon's id.
	// callback -- callback function.
	//  data -- information of beacon. this format is same as one beacon of beacons list.
	//  err -- error message string. if success, this is null.

	// debug: do something here
	callback({
		id: id,
		place: [200, 400, 800],
		owner: "user",
		date: (new Date())
	}, null);
}


function removeBeacon(id, callback){
	// remove my beacon.
	//  if beacon is not user's beacon, this function will error.
	//
	// id -- beacon's id.
	// callback -- callback function.
	//  err -- error message string. if success, this is null.


	g_socket.emit("remove", { userId : g_userId, beaconId : id });


	// debug: do something here
	callback(null);
}
