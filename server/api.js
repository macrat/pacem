/*
 *	API サーバー
 * 	2015 / 08 / 11
*/

"use strict";


module.exports = function(server){
	var fs = require("fs");
	var url = require('url');
	var sqlite3 = require("sqlite3").verbose();

	var fileDb = "test.db";

	// テーブル作成処理のみ
	if (!fs.existsSync(fileDb)) {
		var db = new sqlite3.Database(fileDb);
		db.serialize(function() {
			db.run("create table Beacons(id integer primary key, userId INTEGER, lat REAL, lng REAL, alt REAL, type INTEGER, update_date TIMESTAMP DEFAULT (DATETIME('now','localtime')));");
			db.run("create table Users(id integer primary key, pass TEXT, name TEXT UNIQUE, update_date TIMESTAMP DEFAULT (DATETIME('now','localtime')));");
		});
		db.close();
	}


	// Socket.io の処理
	var io = require("socket.io")(server);
	io.sockets.on("connection", doRequestSocketIo);


	// ビーコン情報構造体
	function Beacon(data)
	{
		this.userId = data.userId;
		this.beaconId = data.beaconId;
		this.lat = data.lat;
		this.lng = data.lng;
		this.alt = data.alt;
		this.type = data.type;
		this.timestamp = data.timestamp;
		this.username = data.username;
		this.data = data;
	}


	// ユーザー情報構造体
	function UserInfo(id, pass, name, timestamp)
	{
		this.id = id;
		this.pass = pass;
		this.name = name;
		this.timestamp = timestamp;
	}


	// ソケットに各種 API を関連付ける。
	function RegistSocketAPI(socket, user_info)
	{
		// 各種 API
		// 位置情報のセット
		socket.on("set", function(req) {
	// DEBUG("Set Beacon info\nlat : " + req.lat + "\nlng : " + req.lng + "\n");
			var db = new sqlite3.Database(fileDb);
			db.serialize(function() {
				// ビーコン追加サンプル
				db.run("INSERT INTO Beacons (userId, lat, lng, alt, type) VALUES (?,?,?,?,?)", user_info.id, req.lat, req.lng, req.alt, req.type, function(err){
					if(err){
						io.sockets.emit("set-ret", { status: 0, msg: "internal server error" });
					}else{
						io.sockets.emit("set-ret", { status:1, msg: null });
					}
				});
			});
			db.close();
		});
		socket.on("get-my-beacons", function(req) {
			// ビーコン取得サンプル
			var db = new sqlite3.Database(fileDb);
			var tmp = new Array();
			db.serialize(function() {
				db.each("SELECT * FROM Beacons WHERE userId=?", user_info.id, function(err, row) {
	//				tmp.push(new Beacon(row.userId, row.id, row.lat, row.lng, row.alt, row.type, row.update_date));
					tmp.push(new Beacon({
						userId : row.userId,
						beaconId : row.id,
						id : row.id,
						lat : row.lat,
						lng : row.lng,
						alt : row.alt,
						type : row.type,
						timestamp : row.update_date,
						username: user_info.name}));
				});
			});
			db.close(function(err) {
				if (err) {
					console.error(err.message);
					io.sockets.emit("get-my-beacons-ret", { status:0, msg:"internal server error" });
					return;
				}

				io.sockets.emit("get-my-beacons-ret", { status:1, beacons:tmp });
			});
		});
		// ユーザーの作成した特定のビーコンを削除する処理
		socket.on("remove", function(req) {
			var db = new sqlite3.Database(fileDb);
			db.serialize(function() {
				db.each("SELECT * FROM Beacons WHERE id == ?", req.beaconId, function(err, row){
					if(row.userId != user_info.id){
						io.sockets.emit("remove-ret", { status:0, msg:"this beacon is not yours" });
					}else{
						db.run("DELETE FROM Beacons WHERE id == ?", req.beaconId, function(err){
							if(err){
								io.sockets.emit("remove-ret", { status:0, msg:"unknown error" });
							}else{
								io.sockets.emit("remove-ret", { status:1 });
							}
						})
					}
				}, function(err, rownum){
					if(err){
						io.sockets.emit("remove-ret", { status:0, msg:"unknown error" });
					}else if(rownum == 0){
						io.sockets.emit("remove-ret", { status:0, msg:"no such beacon" });
	DEBUG("Beacon removed.");
					}
				});
			});
		});

		// ユーザー関連処理
		// パスワード変更
		socket.on("user-change-pass", function(req) {
			if (req.npass.length == 0) {
	DEBUG("[user-change-pass]\tparameter is unjust.");
				io.sockets.emit("user-change-pass-ret", { status:0, msg:"parameter is unjust" });
				return;
			}


			var db = new sqlite3.Database(fileDb);
			var emsg = "";
			db.serialize(function() {
				db.run("UPDATE Users SET pass = ? WHERE name == ? AND pass == ?", req.npass, user_info.name, user_info.pass, function(err) {
					if (err) {
						emsg = "internal server error";
					}
				});
			});
			db.close(function(err) {
				if(emsg){
					io.sockets.emit("user-change-pass-ret", { status:0, msg:emsg });
				}else{
					io.sockets.emit("user-change-pass-ret", { status:1 });
				}
			});
		});
		// ユーザー名変更
		socket.on("user-change-name", function(req) {
			if (req.nname.length == 0) {
	DEBUG("[user-change-name]\tparameter is unjust.");
				io.sockets.emit("user-change-name-ret", { status:0, msg:"parameter is unjust" });
				return;
			}


			var db = new sqlite3.Database(fileDb);
			var emsg = "";
			db.serialize(function() {
				db.run("UPDATE Users SET name = ? WHERE name == ? AND pass == ?", req.nname, user_info.name, user_info.pass, function(err) {
					if (err) {
						emsg = "internal server error";
					}
				});
			});
			db.close(function(err) {
				if(emsg){
					io.sockets.emit("user-change-name-ret", { status:0, msg:emsg });
				}else{
					io.sockets.emit("user-change-name-ret", { status:1 });
				}
			});
		});


		// ユーザー情報の変更
		socket.on("update-user-info", function(req) {
			if (!req) {
	DEBUG("[update-user-info]\tparameter is unjust.");
				io.sockets.emit("update-user-info-ret", "parameter is unjust");
				return;
			}


			var db = new sqlite3.Database(fileDb);

			db.serialize(function() {
				if(req.name){
					db.each("SELECT * from Ussers WHERE name==?", req.name, function(err, row){}, function(err, rownum){
						if(rownum > 0){
							io.sockets.emit("update-user-info-ret", "new name is already exists");
							return;
						}

						if (req.pass) {
							db.run("UPDATE Users SET name = ?, pass = ? WHERE name == ? AND pass == ?", req.name, req.pass, user_info.name, user_info.pass, function(err) {
								if(err){
									io.sockets.emit("update-user-info-ret", "internal server error");
								}else{
									io.sockets.emit("update-user-info-ret", null);
								}
							});
						}
						else {
							db.run("UPDATE Users SET name = ? WHERE name == ? AND pass == ?", req.name, user_info.name, user_info.pass, function(err) {
								if (err) {
									io.sockets.emit("update-user-info-ret", "internal server error");
								}else{
									io.sockets.emit("update-user-info-ret", null);
								}
							});
						}
					});
				}else if (req.pass) {
					db.run("UPDATE Users SET pass = ? WHERE name == ? AND pass == ?", req.pass, user_info.name, user_info.pass, function(err) {
						if (err) {
							io.sockets.emit("update-user-info-ret", "internal server error");
						}else{
							io.sockets.emit("update-user-info-ret", null);
						}
					});
				}
			});
		});


		// ユーザー削除
		socket.on("user-delete", function(req) {
			var db = new sqlite3.Database(fileDb);
			db.serialize(function() {
				db.each("SELECT * FROM Users WHERE name == ? AND pass == ?", user_info.name, user_info.pass, function(err, row){
					db.run("DELETE FROM Users WHERE name == ?", user_info.name, function(err){
						if(err){
							io.sockets.emit("user-delete-ret", { status:0, msg:"unknown error" });
						}else{
							io.sockets.emit("user-delete-ret", { status:1 });
						}
					});
				}, function(err, rownum){
					if(err){
						io.sockets.emit("user-delete-ret", { status:0, msg:"unknown error" });
					}else if(rownum == 0){
						io.sockets.emit("user-delete-ret", { status:0, msg:"incorrect user name or password" });
					}
				});
			});
		});

		return;
	}


	// Socket.IO のリクエスト処理
	function doRequestSocketIo(socket)
	{
		// 接続成功を送信
		socket.emit("connected");


		// 初期化メッセージを受信した時
		socket.on("init", function(req) {
			DEBUG("New user connected server.");
		});
		// 切断したとき
		socket.on("disconnect", function () {
			DEBUG("User disconnected.");
		});


		// ユーザー管理用 API
		// ユーザー追加
		socket.on("user-add", function(req) {
			if (req.pass.length == 0 || req.name.length == 0) {
	DEBUG("[user-add]\tparameter is unjust.");
				io.sockets.emit("user-add-ret", { status:0, msg:"parameter is unjust" });
				return;
			}


			var db = new sqlite3.Database(fileDb);
			db.serialize(function() {
				db.run("INSERT INTO Users (pass, name) VALUES (?,?)", req.pass, req.name, function(err){
					if(err){
						if(err.message.search("UNIQUE") >= 0){
							io.sockets.emit("user-add-ret", { status:0, msg:"this user name already exists" });
						}else{
							io.sockets.emit("user-add-ret", { status:0, msg:"internal server error" });
						}
					}else{
						db.each("SELECT * FROM Users WHERE name == ?", req.name, function(err, row) {
							io.sockets.emit("user-add-ret", { status:1, userinfo: {
								id: row.id,
								name: row.name,
								timestamp: row.update_date
							} });

							if (!socket.flagLogin) {
								RegistSocketAPI(socket, {
									id: row.id,
									name: row.name,
									timestamp: row.update_date,
									pass: row.pass
								});
								socket.flagLogin = 1;
							}
						}, function (err, rownum) {
							if(err || rownum == 0){
								io.sockets.emit("user-add-ret", { status:0, msg:"unknown error" });
							}
						});
					}
				});
			});
		});
		// NAME と PASS が正しいか否かを判定
		socket.on("user-verify", function(req) {
			// req.id, req.pass
			var db = new sqlite3.Database(fileDb);
			db.serialize(function() {
				db.each("SELECT * FROM Users WHERE name==? AND pass==?", req.name, req.pass, function(err, row) {
					if(err) {
						console.log("error: " + err);
						io.sockets.emit("user-verify-ret", { status: 0, msg: "internal server error" });
					}
					else {
						io.sockets.emit("user-verify-ret", { status:1, userinfo:{
							id: row.id,
							name: row.name,
							timestamp: row.update_date
						} });

						// ログイン成功。
						// APIサーバー開発法第二条に従い、各種 API を使用可能にする。
						if (!socket.flagLogin) {
							RegistSocketAPI(socket, {
								id: row.id,
								name: row.name,
								pass: row.pass,
								timestamp: row.update_date
							});
							socket.flagLogin = 1;
						}
					}
				}, function (err, rownum) {
					if (err) {
						io.sockets.emit("user-verify-ret", { status:0, msg:"internal server error" });
					}
					else if (rownum == 0) {
						io.sockets.emit("user-verify-ret", { status:0, msg:"incorrect user name or password" });
					}
				});
			});
		});

		// 周辺のビーコンを取得
		socket.on("get", function(req) {
	// DEBUG("Get Beacon info\nlat : " + req.lat + "\nlng : " + req.lng + "\n");
			// ビーコン取得サンプル
			var db = new sqlite3.Database(fileDb);
			var tmp = new Array();
			db.serialize(function() {
				db.each("SELECT Beacons.id, Users.name, lat, lng, Beacons.update_date, type FROM Beacons, Users WHERE Beacons.userId==Users.id", function(err, row) {
	//				console.log(row.id + ": " + row.userId + "[" + row.lat + "," + row.lng + "," + row.alt + "]" + row.update_date);
	//				tmp.push(new Beacon(row.name, row.id, row.lat, row.lng, row.alt, row.type, row.update_date));
					tmp.push(new Beacon({
						userId : row.userId,
						beaconId : row.id,
						lat : row.lat,
						lng : row.lng,
						alt : row.alt,
						type : row.type,
						timestamp : row.update_date,
						username:row.name}));
				}, function(err){
					if (err) {
						console.log(err);
						io.sockets.emit("get-ret", { status:0, msg: "internal server error" });
					}
				});
			});
			db.close(function(err) {
				if (err) {
					console.error(err.message);
					io.sockets.emit("get-ret", { status:0, msg:err.message });
					return;
				}


				// 周辺にあるビーコンを取得する処理
				var tmp2 = new Array();
				var n = 1.0;
				for (var i = 0; i < tmp.length; ++i) {
					// 近い。
					// (a.x - b.x)**2 + (a.y - b.y)**2 + (a.z - b.z)**2 < n
					if (Math.pow(tmp[i].lat - req.lat, 2) + Math.pow(tmp[i].lng - req.lng, 2) < n) {
						tmp2.push(tmp[i]);
					}
	// console.log("IN LOOP" + i);
				}


				io.sockets.emit("get-ret", { status:1, beacons:tmp2 });
			});
		});

		// あるビーコンを検索する処理
		socket.on("search", function(req) {
	// DEBUG("Search. " + req.beaconId);
			var db = new sqlite3.Database(fileDb);
			var tmp = new Beacon();
			db.serialize(function() {
				db.each("SELECT * FROM Beacons WHERE id=?", req.beaconId, function(err, row) {
					if(err){
						console.log("error: " + err);
					}else{
						tmp.userId = row.userId;
						tmp.beaconId = row.id;
						tmp.lat = row.lat;
						tmp.lng = row.lng;
						tmp.alt = row.alt;
						tmp.type = row.type;
						tmp.timestamp = row.update_date;
					}
				});
			});
			db.close(function(err) {
				if(err){
					console.error(err.message);
				}else{
					io.sockets.emit("search-ret", { beacon:tmp });
				}
	DEBUG("Beacon Searched.");
			});
		});
	}


	function DEBUG(msg)
	{
		console.log(msg);
	}
};
