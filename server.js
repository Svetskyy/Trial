const express = require("express");
const mysql = require("mysql");
const bodyParser = require("body-parser");
const zlib = require("zlib");
const dotenv = require("dotenv");

dotenv.config();

const db = mysql.createPool({
  connectionLimit: 10,
  host: process.env.DB_HOST,
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASS,
  database: process.env.DB_DBNAME,
  compress: true,
  stream: function (options, callback) {
    return zlib.createGzip(options, callback);
  },
});

db.on('connection', (connection) => {
  console.log('New connection made to the database');
});

db.on('error', (err) => {
  console.error('Error in MySQL connection pool:', err);
});

const app = express();
app.use(bodyParser.json({ limit: "50mb" }));

app.use(express.static("./"));

app.get("/", (req, res) => {
  res.sendFile("index.html", { root: "." });
});

app.get("/api/check-connection", (req, res) => {
  if (db.state === 'disconnected') {
    res.json({ connected: false });
  } else {
    res.json({ connected: true });
  }
});

app.post("/api/check", (req, res) => {
  const { sourceCoordinates, destCoordinates } = req.body;
  db.query(
    "SELECT algResults FROM genetic_data1 WHERE sourceCoordinates = ? AND destCoordinates = ?",
    [JSON.stringify(sourceCoordinates), JSON.stringify(destCoordinates)],
    (err, results) => {
      if (err) {
        res.status(500).send("Database error");
        return;
      }
      if (results.length > 0) {
        const algResultsObject = JSON.parse(results[0].algResults);
        res.json({ exists: true, algResults: algResultsObject });
      } else {
        res.json({ exists: false });
      }
    }
  );
});

app.post("/api/save-result", (req, res) => {
  const { sourceCoordinates, destCoordinates, algResults } = req.body;

  db.query(
    "INSERT INTO genetic_data1 (sourceCoordinates, destCoordinates, algResults) VALUES (?, ?, ?)",
    [
      JSON.stringify(sourceCoordinates),
      JSON.stringify(destCoordinates),
      JSON.stringify(algResults),
    ],
    (err, results) => {
      if (err) {
        res.status(500).send("Error saving to database");
        return;
      }
      res.send({ message: "Data saved successfully", id: results.insertId });
    }
  );
});

app.delete("/api/delete-directions", (req, res) => {
  const { sourceCoordinates, destCoordinates } = req.body;
  db.query(
    "DELETE FROM genetic_data1 WHERE sourceCoordinates = ? AND destCoordinates = ?",
    [
      JSON.stringify(sourceCoordinates),
      JSON.stringify(destCoordinates),
    ],
    function (err) {
      if (err) {
        console.error(err);
        res.status(500).send("Error deleting directions from the database");
        return;
      }
      res.status(200).send({ message: "Data deleted successfully" });
    }
  );
});

app.listen(process.env.DB_PORT, () => console.log(`Server running on port ${process.env.DB_PORT}`));
