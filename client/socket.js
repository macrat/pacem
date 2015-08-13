// connection server


var g_socket;
var g_userId = 0;
var g_userName = "";
// 位置情報
var g_lat, g_lng;


function InitSocket(socket, connectCallback, disconnectCallback)
{
	g_socket = socket;
	//サーバから受け取るイベント
	g_socket.on("connect", connectCallback);
	g_socket.on("disconnect", disconnectCallback);
}


function UserAdd(pPass, pName, callback)
{
	// User add.
	//
	// callback -- callback function.
	g_socket.emit("user-add", { pass:pPass, name:pName });
	g_socket.on("user-add-ret", function (data) {
		callback(data.msg, null);
	});
}


function UserDelete(pPass, pName, callback)
{
	// User delete
	//
	// callback -- callback function.
	g_socket.emit("user-delete", { pass:pPass, name:pName });
	g_socket.on("user-delete-ret", function (data) {
		callback(data.msg, null);
	});
}


function UserChangeName(newName, callback)
{
	g_socket.emit("user-change-name", { nname:newName });
	g_socket.on("user-change-name-ret", function (data) {
		callback(data.msg, null);
	});
}


function login(pName, pPass, callback){
	// login.
	//
	// callback -- callback function.
	//  data.status	-> 0 : err
	//		-> 1 : success


	g_socket.emit("user-verify", { pass:pPass, name:pName });
	g_socket.on("user-verify-ret", function (data) {
		if (data.status == 1) {
			// ログイン成功
			g_userId = data.userinfo.id;
			g_userName = data.userinfo.name;
		}

		callback(data, null);
	});
}


function getUserInfo(){
	// get user information.
	//
	// resunt: user information.

	// debug: do something here

	// ログイン時に設定された値を返す。
	return { ID: g_userId, name: g_userName, lat:g_lat, lng:g_lng };
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
	if (callback) {
		callback(null);
	}
}


function getNearBeacons(callback){
	// get near beacons list.
	//
	// callaback -- callback function.
	//  beacons -- list of beacon information.
	//   beaconId -- beacon's id
	//   lat
	//   lng
	//   alt
	//   userId -- beacon owner id.
	//   type
	//   timestamp -- beacon established date time.


	g_socket.emit("get", { lat : g_lat, lng : g_lng });
	if (callback) {
		g_socket.on("get-ret", function (data) {
			callback(data.beacons, null);
		});
	}
}


function getMyBeacons(callback){
	// get my beacons list.
	//
	// callback -- callback function. parameters is same as getNearBeacons.
	//  beacons -- list of beacon information.
	//   beaconId -- beacon's id
	//   lat
	//   lng
	//   alt
	//   userId -- beacon owner id.
	//   type
	//   timestamp -- beacon established date time.

	g_socket.emit("get-my-beacons", {});
	if (callback) {
		g_socket.on("get-my-beacons-ret", function (data) {
			callback(data.beacons, null);
		});
	}
}


function putBeacon(pType, callback){
	// put beacon to now place.
	//
	// type -- beacon type ID.
	// callback -- callback function..
	//  err -- error message string. if success, this is null.


	g_socket.emit("set", { type : pType, lat : g_lat, lng : g_lng });


	// debug: do something here
	if (callback) {
		callback(null);
	}
}


function getBeacon(id, callback){
	// get particular beacon with beaconID.
	//
	// id -- beacon's id.
	// callback -- callback function.
	//  data -- information of beacon. this format is same as one beacon of beacons list.
	//  err -- error message string. if success, this is null.


	g_socket.emit("search", { beaconId : id });
	if (callback) {
		g_socket.on("search-ret", function (data) {
			callback(data.beacon, null);
		});
	}

/*	// debug: do something here
	callback({
		id: id,
		place: [200, 400, 800],
		owner: "user",
		date: (new Date())
	}, null);*/
}


function removeBeacon(id, callback){
	// remove my beacon.
	//  if beacon is not user's beacon, this function will error.
	//
	// id -- beacon's id.
	// callback -- callback function.
	//  err -- error message string. if success, this is null.


	g_socket.emit("remove", { beaconId : id });
	if (callback) {
		g_socket.on("remove-ret", function (err) {
			callback(err.msg, null);
		});
	}
}
