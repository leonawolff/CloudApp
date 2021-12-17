var debug = 0
const express = require("express")
const path = require("path")
const app = express()
const AWS = require("aws-sdk");
const port = 3000
const publicKey ="AKIAVLZJKEUV5F3S35OO"
const privateKey = "6Edx2t5TCcDCSuuFMYaYPDRoJmQgJJ3sWigR1GX8"
const BUCKET = 'csu44000assignment220';
const OBJECT = 'moviedata.json';
let publicPath = path.resolve(__dirname, "public")

app.use(express.static(publicPath))
app.get("/create", create)
app.get("/queryDB/:movieName/:year/:rating", queryDB)
app.get("/destroy", destroy)
app.get("/", function (req, res) {
    res.sendFile(path.join(__dirname + "/public/CloudApp.html"))
})

AWS.config.update({
    region: 'eu-west-1',
    accessKeyId: publicKey,
    secretAccessKey: privateKey
});
var s3 = new AWS.S3({apiVersion: '2006-03-01'});
var dynamodb = new AWS.DynamoDB();
var docClient = new AWS.DynamoDB.DocumentClient();

app.listen(port, function () {
    console.log("Cloud App is listening on port " + port)
})

async function create(req, res) {
    console.log("Creating")
    var s3params = {
        Bucket: BUCKET,
        Key: OBJECT
    }
    let movieData = await s3.getObject(s3params).promise();
    console.log("Bees");
    movieData = JSON.parse(movieData.Body.toString("utf-8"));
    var params = {
        TableName: "Movies",
        KeySchema: [
            { AttributeName: "year", KeyType: "HASH" },  //Partition key
            { AttributeName: "title", KeyType: "RANGE" }  //Sort key
        ],
        AttributeDefinitions: [
            { AttributeName: "year", AttributeType: "N" },
            { AttributeName: "title", AttributeType: "S" }
        ],
        ProvisionedThroughput: {
            ReadCapacityUnits: 10,
            WriteCapacityUnits: 10
        }
    };
    console.log("Knees");
    await dynamodb.createTable(params).promise();    
    await dynamodb.waitFor('tableExists', { TableName: 'Movies' }).promise();
    populateDB(movieData);
}

async function populateDB(movieData) {
    console.log("Populating Database");
    movieData.forEach(async function(movie) {
        var params = {
            TableName: "Movies",
            Item: {
                "title" : movie.title,
                "year" : movie.year,
                "rating" : movie.info.rating,
                "rank" : movie.info.rank
            }
        };
        await docClient.put(params, function(err, data) {
            if(err) {
                console.error("Unable to add", movie.title, "Error", JSON.stringify(err, null, 2));
            } else {
                   console.log("Added item successfully", movie.title);
            }     
        }).promise();
    });
}

async function queryDB(req, res) {
    console.log("Query time");
    var year = parseInt(req.params.year)
    var movieName = req.params.movieName
    var rating = parseFloat(req.params.rating);
    var params = {
        TableName : "Movies",
        ExpressionAttributeValues: {
            ":year": year,
            ":movieName": movieName,
            ":rating": rating
        },
        FilterExpression: "#yr = :year and rating >= :rating and begins_with (title, :movieName)",
        ExpressionAttributeNames:{
            "#yr": "year"
        }       
    };
    let data = await docClient.scan(params).promise();
    console.log(data.Items);
    res.json({result: data.Items});
}

function destroy(req, res) {
    console.log("Destroying");
    var params = {
        TableName : "Movies",
    };
    dynamodb.deleteTable(params, function(err, data) {
        if (err) {
            console.error("Unable to delete table. Error JSON:", JSON.stringify(err, null, 2));
        } else {
            console.log("Deleted table. Table description JSON:", JSON.stringify(data, null, 2));
        }
    });
}