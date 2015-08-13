﻿/*
 *	API サーバー
 * 	2015 / 08 / 11
*/

"use strict";

/*
 *	GPS 情報関連
 *	Set
 *	Get
 *	Search
*/


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
		db.run("create table Beacons(id integer primary key, userId INTEGER, lat REAL, lng REAL, alt REAL, update_date TIMESTAMP DEFAULT (DATETIME('now','localtime')));");
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
function Beacon(userId, beaconId, lat, lng, alt, timestamp)
{
	this.userId = userId;
	this.beaconId = beaconId;
	this.lat = lat;
	this.lng = lng;
	this.alt = alt;
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


var g_beaconDB = new Array();


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


	// 各種 API
	// 位置情報のセット
	socket.on("set", function(req) {
		DEBUG("Set Beacon info\nlat : " + req.lat + "\nlng : " + req.lng + "\n");


		var db = new sqlite3.Database(fileDb);
		db.serialize(function() {
			// ビーコン追加サンプル
			// http://stackoverflow.com/questions/22022633/inserting-id-field-autoincrement-with-sqlite3-and-node-js
			var stmt = db.prepare("INSERT INTO Beacons (userId, lat, lng, alt) VALUES (?,?,?,?)");
			// userid, lat, lng, timestamp
			stmt.run(req.userId, req.lat, req.lng, req.alt);
			stmt.finalize();
		});
		db.close();


		// 既存のビーコンが移動しただけか？
		// macrat : チェックする機能は追加機能でいいかも。

		var timestamp = Math.floor( new Date().getTime() / 1000 );
		var tmp = new Beacon(req.userId, req.beaconId, req.lat, req.lng, req.alt, timestamp);
		g_beaconDB.push(tmp);
		io.sockets.emit("set-ret", { status:"success" , beacon : tmp });
	});
	// 周辺のビーコンを取得
	socket.on("get", function(req) {
		DEBUG("Get Beacon info\nlat : " + req.lat + "\nlng : " + req.lng + "\n");


		// ビーコン取得サンプル
		var db = new sqlite3.Database(fileDb);
		var tmp = new Array();
		db.serialize(function() {
			db.each("SELECT id, userId,lat,lng,update_date FROM Beacons", function(err, row) {
//				console.log(row.id + ": " + row.userId + "[" + row.lat + "," + row.lng + "," + row.alt + "]" + row.update_date);
				tmp.push(new Beacon(row.userId, row.id, row.lat, row.lng, row.alt, row.update_date));
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
		DEBUG("Search. " + req.beaconId);

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

	// あるユーザーの作成した特定のビーコンを削除する処理
	socket.on("remove", function(req) {
		var db = new sqlite3.Database(fileDb);
		db.serialize(function() {
			var stmt = db.prepare("DELETE FROM Beacons WHERE userId = ? AND id = ?");
			stmt.run(req.userId, req.beaconId);
			stmt.finalize();
		});
		db.close(function(err) {
			if (err) {
				console.error(err.message);
				return;
			}

DEBUG("Beacon removed.");
		});
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
	// ユーザー削除
	socket.on("user-delete", function(req) {
		if (req.pass.length == 0 || req.name.length == 0) {
DEBUG("[user-delete]\tparameter is unjust.");
			io.sockets.emit("user-delete-ret", { status:0, msg:"parameter is unjust." });
			return;
		}


		var db = new sqlite3.Database(fileDb);
		db.serialize(function() {
			db.each("SELECT * FROM Users WHERE name == ? AND pass == ?", req.name, req.pass, function(err, row){
				db.run("DELETE FROM Users WHERE name == ?", req.name, function(err){
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
console.log(tmp);
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
			}
			else {
				io.sockets.emit("user-verify-ret", { status:0, userinfo:tmp });
			}
		});
	});
	// パスワード変更
	socket.on("user-change-pass", function(req) {
	});
	// ユーザー名変更
	socket.on("user-change-name", function(req) {
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
				tmp.push(new Beacon(row.userId, row.id, row.lat, row.lng, row.alt, row.update_date));
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

