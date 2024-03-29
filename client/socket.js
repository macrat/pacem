// connection server


var g_socket = io.connect("http://" + location.host);
var g_userId = 0;
var g_userName = "";


function addConnectListener(callback){
	// add callback when connect.
	//
	// callback -- callback function.

	g_socket.on("connect", callback);
}

function addDisconnectListener(callback){
	// add callback when disconnect.
	//
	// callback -- callback function.

	g_socket.on("disconnect", callback);
}


function createAccount(data, callback)
{
	// create user account.
	//
	// data -- new user information.
	//  name -- unique user name.
	//  password -- password.
	// callback -- callback function.
	//  err -- error message string. if success, this is null.

	g_socket.emit("user-add", { name:data.name, pass:data.password });
	function cb(data) {
		g_socket.removeListener("user-add-ret", cb);

		g_userId = data.userinfo.id;
		g_userName = data.userinfo.name;

		callback(data.msg);
	}
	g_socket.on("user-add-ret", cb);
}


function login(userid, password, callback){
	// login.
	//
	// userid -- user ID string.
	// password -- password string.
	// callback -- callback function.
	//  err -- error message string. if success, this is null.


	g_socket.emit("user-verify", { name:userid, pass:password });
	function cb(data) {
		g_socket.removeListener("user-verify-ret", cb);

		if (data.status == 1) {
			// ログイン成功
			g_userId = data.userinfo.id;
			g_userName = data.userinfo.name;

			function autoReLogin(){
				login(userid, password, function(e){});
			}
			g_socket.removeListener("connect", autoReLogin);
			g_socket.on("connect", autoReLogin);

			callback(null);
		}else{
			callback(data.msg);
		}
	}
	g_socket.on("user-verify-ret", cb);
}


function getUserInfo(){
	// get user information.
	//
	// result: user information.

	// ログイン時に設定された値を返す。
	return { ID: g_userId, name: g_userName };
}


function updateUserInfo(data, callback){
	// update user information.
	//
	// data -- new user information.
	//  name -- new user name.
	//  password -- new password.
	// callback -- callback function.
	//  err -- error message string. if success, this is null.

	g_socket.emit("update-user-info", {
		name: data.name,
		pass: data.password
	});
	function cb(err){
		g_socket.removeListener("update-user-info-ret", cb);

		if(!err && data.name){
			g_userName = data.name;
		}

		callback(err);
	}
	g_socket.on("update-user-info-ret", cb);
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
	//   type -- beacon type number.
	//  err -- error message string. if success, this is null.

	getPosition(function(position){
		g_socket.emit("get", { lat : position.coords.latitude, lng : position.coords.longitude });
		function cb(data) {
			g_socket.removeListener("get-ret", cb);
			if (!data.status) {
				callback(null, data.msg);
				return;
			}

			var ls = [];

			for(var i in data.beacons){
				ls.push({
					id: data.beacons[i].beaconId,
					place: [data.beacons[i].lat, data.beacons[i].lng, data.beacons[i].alt],
					owner: data.beacons[i].username,
					date: new Date(data.beacons[i].timestamp),
					type: data.beacons[i].type
				});
			}
			callback(ls, data.msg);
		}
		g_socket.on("get-ret", cb);
	});
}


function getMyBeacons(callback){
	// get my beacons list.
	//
	// callback -- callback function. parameters is same as getNearBeacons.

	g_socket.emit("get-my-beacons", {});
	function cb(data) {
		g_socket.removeListener("get-my-beacons-ret", cb);
		if (!data.status) {
			callback(null, data.msg);
			return;
		}


		var ls = [];

		for(var i in data.beacons){
			ls.push({
				id: data.beacons[i].beaconId,
				place: [data.beacons[i].lat, data.beacons[i].lng, data.beacons[i].alt],
				owner: data.beacons[i].username,
				date: new Date(data.beacons[i].timestamp),
				type: data.beacons[i].type
			});
		}
		callback(ls, data.msg);
	}
	g_socket.on("get-my-beacons-ret", cb);
}


function putBeacon(pType, callback){
	// put beacon to now place.
	//
	// type -- beacon type ID.
	// callback -- callback function..
	//  err -- error message string. if success, this is null.

	getPosition(function(position){
		g_socket.emit("set", { type : pType, lat : position.coords.latitude, lng : position.coords.longitude })

		function cb(data){
			g_socket.removeListener("set-ret", cb);
			callback(data.msg);
		}
		g_socket.on("set-ret", cb);
	});
}


function getBeacon(id, callback){
	// get particular beacon with beaconID.
	//
	// id -- beacon's id.
	// callback -- callback function.
	//  data -- information of beacon. this format is same as one beacon of beacons list.
	//  err -- error message string. if success, this is null.

	g_socket.emit("search", { beaconId : id });
	function cb(data){
		g_socket.removeListener("search-ret", cb);
		callback(data.beacon, data.msg);
	}
	g_socket.on("search-ret", cb);
}


function removeBeacon(id, callback){
	// remove my beacon.
	//  if beacon is not user's beacon, this function will error.
	//
	// id -- beacon's id.
	// callback -- callback function.
	//  err -- error message string. if success, this is null.


	g_socket.emit("remove", { beaconId : id });
	function cb(data){
		g_socket.removeListener("remove-ret", cb);
		callback(data.msg);
	}
	g_socket.on("remove-ret", cb);
}
