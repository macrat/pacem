// connection server


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

	// debug: do something here
	//  this is for debug
	navigator.geolocation.getCurrentPosition(function(e){
		var near = [];
		for(var i=0; i<50; i++){
			near.push({
				id: i,
				place: [e.coords.latitude+(Math.random()*0.04-0.02), e.coords.longitude+(Math.random()*0.04-0.02), 0],
				owner: ["this", "is", "test"][i%3],
				date: new Date((new Date()) - Math.random()*1000*60*60*24*7)
			});
		}
		callback(near, null);
	}, function(){
		callback(null, "failed get location");
	});
}


function getMyBeacons(callback){
	// get my beacons list.
	//
	// callback -- callback function. parameters is same as getNearBeacons.

	// debug: do something here
	//  this is for debug
	navigator.geolocation.getCurrentPosition(function(e){
		var my = [];
		for(var i=0; i<3; i++){
			my.push({
				id: i+100,
				place: [e.coords.latitude+(Math.random()*0.1-0.05), e.coords.longitude+(Math.random()*0.1-0.05), 0],
				owner: "your name",
				date: new Date((new Date()) - Math.random()*1000*60*60*24*30)
			});
		}
		callback(my, null);
	}, function(){
		callback(null, "failed get location");
	});
}


function putBeacon(type, callback){
	// put beacon to now place.
	//
	// type -- beacon type ID.
	// callback -- callback function..
	//  err -- error message string. if success, this is null.

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

	// debug: do something here
	callback(null);
}
