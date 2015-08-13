/*
 *	API サーバー
 * 	2015 / 08 / 11
*/

"use strict";


var http = require("http");
var socketio = require("socket.io");
var fs = require("fs");
var url = require('url');
var sqlite3 = require("sqlite3").verbose();


var fileDb = "test.db";
var isExistsDb = fs.existsSync(fileDb);

// テーブル作成処理のみ
if (!isExistsDb) {
	var db = new sqlite3.Database(fileDb);
	db.serialize(function() {
		db.run("create table Beacons(id integer primary key, userId INTEGER, lat REAL, lng REAL, alt REAL, type INTEGER, update_date TIMESTAMP DEFAULT (DATETIME('now','localtime')));");
		db.run("create table Users(id integer primary key, pass TEXT, name TEXT UNIQUE, update_date TIMESTAMP DEFAULT (DATETIME('now','localtime')));");
	});
	db.close();
}


var server = http.createServer();
server.listen(3000);
console.log('Server running.');
// Socket.io の処理
var io = socketio.listen(server);
io.sockets.on("connection", doRequestSocketIo);


// ビーコン情報構造体
function Beacon(userId, beaconId, lat, lng, alt, type, timestamp)
{
	this.userId = userId;
	this.beaconId = beaconId;
	this.lat = lat;
	this.lng = lng;
	this.alt = alt;
	this.type = type;
	this.timestamp = timestamp;
}


// ユーザー情報構造体
function UserInfo(id, pass, name, timestamp)
{
	this.id = id;
	this.pass = pass;
	this.name = name;
	this.timestamp = timestamp;
}


var g_userInfo = new UserInfo();


// ソケットに各種 API を関連付ける。
function RegistSocketAPI(socket)
{
	// 各種 API
	// 位置情報のセット
	socket.on("set", function(req) {
// DEBUG("Set Beacon info\nlat : " + req.lat + "\nlng : " + req.lng + "\n");
		var db = new sqlite3.Database(fileDb);
		db.serialize(function() {
			// ビーコン追加サンプル
			var stmt = db.prepare("INSERT INTO Beacons (userId, lat, lng, alt) VALUES (?,?,?,?)");
			stmt.run(g_userInfo.id, req.lat, req.lng, req.alt);
			stmt.finalize();
		});
		db.close();

		var timestamp = Math.floor( new Date().getTime() / 1000 );
		var tmp = new Beacon(g_userInfo.id, req.beaconId, req.lat, req.lng, req.alt, req.type, timestamp);
		io.sockets.emit("set-ret", { status:"success" , beacon : tmp });
	});
	socket.on("get-my-beacons", function(req) {
		// ビーコン取得サンプル
		var db = new sqlite3.Database(fileDb);
		var tmp = new Array();
		db.serialize(function() {
			db.each("SELECT * FROM Beacons WHERE userId=?", g_userInfo.id, function(err, row) {
				tmp.push(new Beacon(row.userId, row.id, row.lat, row.lng, row.alt, row.type, row.update_date));
			});
		});
		db.close(function(err) {
			if (err) {
				console.error(err.message);
				return;
			}

			io.sockets.emit("get-my-beacons-ret", { beacons:tmp });
		});
	});
	// ユーザーの作成した特定のビーコンを削除する処理
	socket.on("remove", function(req) {
		var db = new sqlite3.Database(fileDb);
		db.serialize(function() {
			db.each("SELECT * FROM Beacons WHERE id == ?", req.beaconId, function(err, row){
				if(row.userId != g_userInfo.id){
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
			io.sockets.emit("user-change-pass-ret", { status:0, msg:"parameter is unjust." });
			return;
		}


		var db = new sqlite3.Database(fileDb);
		var emsg = "";
		db.serialize(function() {
			var stmt = db.prepare("UPDATE Users SET pass = ? WHERE name == ? AND pass == ?");
			stmt.run(req.npass, g_userInfo.name, g_userInfo.pass, function(err) {
				if (err) {
					emsg = "Can't change user password.";
				}
			});
			stmt.finalize();
		});
		db.close(function(err) {
			if (emsg.length > 0) {
				io.sockets.emit("user-change-pass-ret", { status:0, msg:emsg });
				return;
			}

			io.sockets.emit("user-change-pass-ret", { status:1 });
		});
	});
	// ユーザー名変更
	socket.on("user-change-name", function(req) {
		if (req.nname.length == 0) {
DEBUG("[user-change-name]\tparameter is unjust.");
			io.sockets.emit("user-change-name-ret", { status:0, msg:"parameter is unjust." });
			return;
		}


		var db = new sqlite3.Database(fileDb);
		var emsg = "";
		db.serialize(function() {
			var stmt = db.prepare("UPDATE Users SET name = ? WHERE name == ? AND pass == ?");
			stmt.run(req.nname, g_userInfo.name, g_userInfo.pass, function(err) {
				if (err) {
					emsg = "Can't change user name.";
				}
			});
			stmt.finalize();
		});
		db.close(function(err) {
			if (emsg.length > 0) {
				io.sockets.emit("user-change-name-ret", { status:0, msg:emsg });
				return;
			}

			io.sockets.emit("user-change-name-ret", { status:1 });
		});
	});


	// ユーザー情報の変更
	socket.on("update-user-info", function(req) {
		if (!req.data) {
DEBUG("[update-user-info]\tparameter is unjust.");
			io.sockets.emit("update-user-info-ret", "parameter is unjust.");
			return;
		}


		// 0 何も変更なし
		// 1 名前のみ変更
		// 2 パスワードのみ変更
		// 3 名前とパスワードを変更
		var cState = 0;
		if (req.data.name) {
			// 名前の変更あり
			cState = 1;
		}
		if (req.data.pass) {
			// パスワードの変更あり
			if (cState == 1) {
				// 名前とパスワードの変更
				cState = 3;
			}
			else {
				cState = 2;
			}
		}

		if (cState == 0) {
			//　変更なし。
			return;
		}


		var db = new sqlite3.Database(fileDb);
		var emsg = "";
		db.serialize(function() {
			var stmt;
			if (cState == 3) {
				stmt = db.prepare("UPDATE Users SET name = ?, pass = ? WHERE name == ? AND pass == ?");
				stmt.run(req.data.name, req.data.pass, g_userInfo.name, g_userInfo.pass, function(err) {
					if (err) {
						emsg = "Can't change user name or password.";
					}
				});
			}
			else if (cState == 2) {
				stmt = db.prepare("UPDATE Users SET pass = ? WHERE name == ? AND pass == ?");
				stmt.run(req.data.pass, g_userInfo.name, g_userInfo.pass, function(err) {
					if (err) {
						emsg = "Can't change user password.";
					}
				});
			}
			else if (cState == 1) {
				stmt = db.prepare("UPDATE Users SET name = ? WHERE name == ? AND pass == ?");
				stmt.run(req.data.name, g_userInfo.name, g_userInfo.pass, function(err) {
					if (err) {
						emsg = "Can't change user name.";
					}
				});
			}
			stmt.finalize();
		});


		db.close(function(err) {
			if (emsg.length > 0) {
				io.sockets.emit("update-user-info-ret", emsg);
				return;
			}

			io.sockets.emit("update-user-info-ret", null);
		});
	});


	// ユーザー削除
	socket.on("user-delete", function(req) {
		var db = new sqlite3.Database(fileDb);
		db.serialize(function() {
			db.each("SELECT * FROM Users WHERE name == ? AND pass == ?", g_userInfo.name, g_userInfo.pass, function(err, row){
				db.run("DELETE FROM Users WHERE name == ?", g_userInfo.name, function(err){
					if(err){
						io.sockets.emit("user-delete-ret", { status:0, msg:"unknown error" });
					}else{
						io.sockets.emit("user-delete-ret", { status:1 });
					}
				})
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
			io.sockets.emit("user-add-ret", { status:0, msg:"parameter is unjust." });
			return;
		}


		var db = new sqlite3.Database(fileDb);
		var emsg = "";
		db.serialize(function() {
			var stmt = db.prepare("INSERT INTO Users (pass, name) VALUES (?,?)");
			// ユーザー追加
			stmt.run(req.pass, req.name, function(err) {
				if (err) {
					emsg = "User name conflict.";
				}
			});
			stmt.finalize();
		});
		db.close(function(err) {
			if (emsg.length > 0) {
				io.sockets.emit("user-add-ret", { status:0, msg:emsg });
				return;
			}

			io.sockets.emit("user-add-ret", { status:1 });
		});
	});
	// NAME と PASS が正しいか否かを判定
	socket.on("user-verify", function(req) {
		// req.id, req.pass
		var db = new sqlite3.Database(fileDb);
		var tmp = new UserInfo();
		var __pass = "";
		db.serialize(function() {
			db.each("SELECT * FROM Users WHERE name=?", req.name, function(err, row) {
				if(err) {
					console.log("error: " + err);
				}
				else {
					tmp.id = row.id;
					// tmp.pass = row.pass;
					__pass = row.pass;
					tmp.name = row.name;
					tmp.timestamp = row.update_date;
// console.log(tmp);
					g_userInfo = tmp;
					g_userInfo.pass = row.pass;
					return;
				}
			});
		});
		db.close(function(err) {
			if (err) {
				console.error(err.message);
				return;
			}


			if (req.pass.length > 0 && __pass == req.pass) {
				io.sockets.emit("user-verify-ret", { status:1, userinfo:tmp });

				// ログイン成功。
				// APIサーバー開発法第二条に従い、各種 API を使用可能にする。
				if (!socket.flagLogin) {
					RegistSocketAPI(socket);
					socket.flagLogin = 1;
				}
			}
			else {
				io.sockets.emit("user-verify-ret", { status:0, userinfo:tmp });
			}
		});
	});

	// 周辺のビーコンを取得
	socket.on("get", function(req) {
// DEBUG("Get Beacon info\nlat : " + req.lat + "\nlng : " + req.lng + "\n");
		// ビーコン取得サンプル
		var db = new sqlite3.Database(fileDb);
		var tmp = new Array();
		db.serialize(function() {
			db.each("SELECT id, userId,lat,lng,update_date FROM Beacons", function(err, row) {
//				console.log(row.id + ": " + row.userId + "[" + row.lat + "," + row.lng + "," + row.alt + "]" + row.update_date);
				tmp.push(new Beacon(row.userId, row.id, row.lat, row.lng, row.alt, row.type, row.update_date));
			});
		});
		db.close(function(err) {
			if (err) {
				console.error(err.message);
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


			io.sockets.emit("get-ret", { beacons:tmp2 });
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
			if (err) {
				console.error(err.message);
				return;
			}

			io.sockets.emit("search-ret", { beacon:tmp });
DEBUG("Beacon Searched.");
		});
	});

	// DEBUG 用
	socket.on("get-db", function(req) {
		DEBUG("get db");

		var db = new sqlite3.Database(fileDb);
		var tmp = new Array();
		var tmp2 = new Array();
		db.serialize(function() {
			db.each("SELECT id, userId,lat,lng,update_date FROM Beacons", function(err, row) {
// console.log(row.id + ": " + row.userId + "[" + row.lat + "," + row.lng + "," + row.alt + "]" + row.update_date);
				tmp.push(new Beacon(row.userId, row.id, row.lat, row.lng, row.alt, row.type, row.update_date));
			});
			db.each("SELECT id, pass, name, update_date FROM Users", function(err, row) {
console.log(row.id + ": name=" + row.name + ", pass=" + row.pass + "  [" + row.update_date + "]");
				tmp2.push(new UserInfo(row.id, row.pass, row.name, row.update_date));
			});
		});
		db.close(function(err) {
			if (err) {
				console.error(err.message);
				return;
			}

			io.sockets.emit("get-db-ret", { db : tmp, db2 : tmp2 });
		});
	});
	return;
}


function DEBUG(msg)
{
	console.log(msg);
}


function PRINT_DB()
{
	var db = new sqlite3.Database(fileDb);
	db.serialize(function() {
		db.each("SELECT id, userId,lat,lng,update_date FROM Beacons", function(err, row) {
console.log(row.id + ": " + row.userId + "[" + row.lat + "," + row.lng + "," + row.alt + "]" + row.update_date);
		});
		db.each("SELECT id, pass, name, update_date FROM Users", function(err, row) {
console.log(row.id + ": name=" + row.name + ", pass=" + row.pass + "  [" + row.update_date + "]");
		});
	});
	db.close(function(err) {
		if (err) {
			console.error(err.message);
			return;
		}
	});
}
