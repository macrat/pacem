/*
 *	API サーバー
 * 	2015 / 08 / 11
*/


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
		DEBUG("Search. " + req.id);
		io.sockets.emit("search-ret", { status:"success" });
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



	// DEBUG 用
	socket.on("get-db", function(req) {
		DEBUG("get db");

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

			io.sockets.emit("get-db-ret", { db : tmp });
		});
	});
	return;
}


function DEBUG(msg)
{
	console.log(msg);
}

