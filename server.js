
'use strict';

require('dotenv').config();

const express = require('express');
const app = express();
const superagent = require('superagent');
const cors = require('cors');
const pg = require('pg');

app.use(cors());

const PORT = process.env.PORT;

//Connecting to the database
const client = new pg.Client(process.env.DATABASE_URL);
client.connect();
client.on('error', err => console.log(err));
//API routes

app.get('/location', searchToLatLong);

app.get('/weather', getWeather);

app.get('/events', getEvents);

app.listen(PORT, () => console.log(`Listening on PORT ${PORT}`));


//Helper functions


// function to get location data

function searchToLatLong(request, response) {
  let query = request.query.data;

  //Definte the search query
  let sql = `SELECT * FROM locations WHERE search_query=$1;`;
  let values = [query];

  // console.log('line 71', sql, values);

  //Makes the query of the database
  client.query(sql, values)
    .then(result => {
      console.log('result from database',
        result.rowCount);
      //did the DB return any info?
      if (result.rowCount > 0) {
        response.send(result.rows[0]);
      } else {
        //otherwise go get the data from the API
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${request.query.data}&key=${process.env.GEOCODE_API_KEY}`;

        superagent.get(url)
          .then(result => {
            if (!result.body.results.length) {
              throw 'NO DATA';
            } else {
              let location = new Location(query, result.body.results[0]);

              let newSQL = `INSERT INTO locations (search_query, formatted_address, latitude, longitude) VALUES ($1, $2, $3, $4) RETURNING ID;`;
              let newValues = Object.values(location);

              client.query(newSQL, newValues)
                .then(data => {
                  location.id = data.rows[0].id;
                  response.send(location);
                });
            }
          })
          .catch(error => handleError(error, response));
      }
    });
}

function Location(query, location) {
  this.search_query = query;
  this.formatted_query = location.formatted_address;
  this.latitude = location.geometry.location.lat;
  this.longitude = location.geometry.location.lng;
}



// function searchToLatLong(request, response) {
//   const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${request.query.data}&key=${process.env.GEOCODE_API_KEY}`;

//   superagent.get(url)
//     .then(result => {
//       const location = new Location(result, request.query.data);
//       response.send(location);
//     })
//     .catch(err => handleError(err, response));
// }

// function getWeather(request, response) {
//   const url = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${request.query.data.latitude},${request.query.data.longitude}`;

//   superagent.get(url)
//     .then(result => {
//       const weatherSummaries = result.body.daily.data.map(day => new Weather(day));
//       console.log(weatherSummaries);
//       response.send(weatherSummaries);
//     })
//     .catch(err => handleError(err, response));
// }

//function to get weather data

function getWeather(request, response) {
  let query = request.query.data.id;
  let sql = `SELECT * FROM weathers WHERE location_id=$1;`;
  let values = [query];

  client.query(sql, values)
    .then(result => {
      if (result.rowCount > 0) {
        // console.log('Weather from SQL');
        response.send(result.rows);
      } else {
        const url = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${request.query.data.latitude},${request.query.data.longitude}`;

        return superagent.get(url)
          .then(weatherResults => {
            // console.log('Weather from API');
            if (!weatherResults.body.daily.data.length) { throw 'NO DATA'; }
            else {
              const weatherSummaries = weatherResults.body.daily.data.map(day => {
                let summary = new Weather(day);
                summary.id = query;

                let newSql = `INSERT INTO weathers (forecast, time, location_id) VALUES($1, $2, $3);`;
                let newValues = Object.values(summary);
                // console.log(newValues);
                client.query(newSql, newValues);

                return summary;

              });
              response.send(weatherSummaries);
            }

          })
          .catch(error => handleError(error, response));
      }
    });
}

function Weather(day) {
  this.forecast = day.summary;
  this.time = new Date(day.time * 1000).toString().slice(0, 15);
}


// function getEvents(request, response) {
//   const url = `https://www.eventbriteapi.com/v3/events/search?token=${process.env.EVENTBRITE_API_KEY}&location.address=${request.query.data.formatted_query}`;

//   superagent.get(url)
//     .then(result => {
//       const events = result.body.events.map(eventData => {
//         const event = new Event(eventData);
//         return event;
//       });

//       response.send(events);
//     })
//     .catch(error => handleError(error, response));
// }

function getEvents(request, response) {
  const url = `https://www.eventbriteapi.com/v3/events/search?token=${process.env.EVENTBRITE_API_KEY}&location.longitude=${request.query.data.longitude}&location.latitude=${request.query.data.latitude}&expand=venue`;

  superagent.get(url)
    .then(result => {
      const events = result.body.events.map(eventData => {
        const event = new Event(eventData);
        console.log('********************************************************************************************');
        console.log(event);
        return event;
      });

      response.send(events);
    })
    .catch(error => handleError(error, response));
}

function Event(event) {
  this.link = event.url;
  this.name = event.name.text;
  this.event_date = new Date(event.start.local).toString().slice(0, 15);
  this.summary = event.summary;
}




// function Location(data, userData) {
//   this.formatted_query = data.body.results[0].formatted_address;
//   this.latitude = data.body.results[0].geometry.location.lat;
//   this.longitude = data.body.results[0].geometry.location.lng;
//   this.query = userData;
// }

// function Weather(day) {
//   let time = new Date(day.time * 1000);
//   // multiply by 1000 to get proper timing
//   this.time = time.toDateString();
//   this.forecast = day.summary;
// }



function handleError(err, response) {
  console.error(err);
  if (response) response.status(500).send('Sorry, something is not right');
}


// 'use strict';

// // Load Environment Variables from the .env file
// require('dotenv').config();

// // Application Dependencies
// const express = require('express');
// const cors = require('cors');
// const superagent = require('superagent');

// // Application Setup
// const app = express();
// app.use(cors());
// const PORT = process.env.PORT

// // Incoming API Routes
// app.get('/location', searchToLatLong);
// app.get('/weather', getWeather);

// // Make sure the server is listening for requests
// app.listen(PORT, () => console.log(`City Explorer is up on ${PORT}`));

// // Helper Functions

// function searchToLatLong(request, response) {
//   // Define the URL for the GEOCODE  API
//   const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${request.query.data}&key=${process.env.GEOCODE_API_KEY}`;
//   // console.log(url);

//   superagent.get(url)
//     .then(result => {
//       // console.log(result.body.results[0]);
//       const location = new Location(request.query.data, result);
//       response.send(location);
//     })
//     .catch(err => handleError(err, response));
// }

// function Location(query, res) {
//   this.search_query = query;
//   this.formatted_query = res.body.results[0].formatted_address;
//   this.latitude = res.body.results[0].geometry.location.lat;
//   this.longitude = res.body.results[0].geometry.location.lng;
// }

// function getWeather(request, response) {
//   // Define the URL for the DARKSKY API
//   const url = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${request.query.data.latitude},${request.query.data.longitude}`;
//   // console.log(url);

//   superagent.get(url)
//     .then(result => {
//       // console.log(result.body);
//       const weatherSummaries = result.body.daily.data.map(day => new Weather(day));
//       response.send(weatherSummaries);
//     })
//     .catch(err => handleError(err, response));
// }

// function Weather(day) {
//   this.forecast = day.summary;
//   this.time = new Date(day.time * 1000).toString().slice(0, 15);
// }

// // Error Handler
// function handleError(err, response) {
//   console.error(err);
//   if (response) response.status(500).send('Sorry something went wrong');
// }



//   try {
//     const locationData = searchToLatLong(request.query.data);
//     response.send(locationData);
//   }
//   catch (error) {
//     console.error(error);
//     response.status(500).send('Status: 500. So sorry, something went wrong.');
//   }
// });

// app.get('/weather', (request, response) => {
//   try {
//     const weatherData = searchWeather(request.query.data.latitude);
//     // =searchWeather();
//     response.send(weatherData);
//   }
//   catch (error) {
//     console.log(error);
//     response.status(500).send('Status: 500. Sorry, something went wrong.');
//   }
//   console.log('From weather request', request.query.data.latitude);
// });

// app.get('/events', getEvent) => {
//   try {
//     const eventData = getEvents(request.query.data);
//     response.send(eventData);
//   }
//   catch (error) {
//     console.log(error);
//     response.status(500).send('Status: 500. Sorry, something went wrong.');
//   }
// })

