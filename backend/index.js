const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');  
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

const pool = new Pool({
    connectionString: process.env.PGCONNECTION
});

// const authenticateJWT = (req, res, next) => {
//     const token = req.header('Authorization');
//     if (!token) return res.sendStatus(403);
//     jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
//         if (err) return res.sendStatus(403);
//         req.user = user;
//         next();
//     });
// };

app.post('/register', async (req, res) => {
    const { email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        await pool.query('INSERT INTO users (email, password) VALUES ($1, $2)', [email, hashedPassword]);
        res.status(201).send('User registered successfully');
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).send('Failed to register user');
    }
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (user && await bcrypt.compare(password, user.password)) {
            const token = jwt.sign({ email: user.email, role: user.role }, process.env.JWT_SECRET);
            res.json({ token });
        } else {
            res.status(401).send('Invalid credentials');
        }
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).send('Log in failed');
    }
});
//seats can be added directly from database only by the admin of the DB and we can insert a new row from database
app.post('/trains', async (req, res) => {
    const { email, from_station, to_station, seats } = req.body;

    try {
        const result = await pool.query('SELECT role FROM users WHERE email = $1', [email]);
        const user = result.rows[0];
        if (!user || user.role !== 'admin') {
            return res.status(403).send('You are not authorized to add trains');
        }
        await pool.query('INSERT INTO trains (from_station, to_station, seats) VALUES ($1, $2, $3)', [from_station, to_station, seats]);
        res.status(201).send('Train added successfully');
    } catch (err) {
        console.error('Error adding train:', err);
        res.status(500).send('Failed to add train');
    }
});


//available trains
app.get('/availability', async (req, res) => {
    const { from, to } = req.query;

    try {
        const result = await pool.query('SELECT * FROM trains WHERE from_station = $1 AND to_station = $2', [from, to]);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching availability:', err);
        res.status(500).send('Failed to fetch available seats');
    }
});

app.post('/book', async (req, res) => {
    const { email, train_id, seats_required } = req.body; 

    if (!email || !train_id || !seats_required) {
        return res.status(400).send('Email, Train ID, and Seats are required, Ensure all the fields are given properly.');
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await client.query('SELECT * FROM trains WHERE id = $1 FOR UPDATE', [train_id]);
        const train = result.rows[0];

        if (!train) {
            return res.status(404).send('Please check the train id again');
        }

        if (seats_required <= train.seats) {
            await client.query('UPDATE trains SET seats = seats-$1 WHERE id =$2', [seats_required, train_id]);

            const createdAt = new Date(); 
            const insertResult = await client.query(
                'INSERT INTO bookings (email, train_id, seats_required, created_at) VALUES ($1, $2, $3, $4) RETURNING id',
                [email, train_id, seats_required, createdAt]
            );

            const bookingId = insertResult.rows[0].id; 
            await client.query('COMMIT');
            res.json({ message: 'Your seats has been booked successfully, please store the booking id and use it for retrieving later on', bookingId }); 
        } else {
            res.status(400).send('Enough seats arent available');
        }
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Booking error:', error);
        res.status(500).send('Booking seat has failed');
    } finally {
        client.release();
    }
});
app.get('/booking/:id', async (req, res) => {
    const bookingId = req.params.id;

    try {
        const result = await pool.query('SELECT * FROM bookings WHERE id=$1', [bookingId]);
        const booking = result.rows[0];

        if (!booking) {
            return res.status(404).send('Booking not in database');
        }

        res.json(booking);
    } catch (err) {
        console.error('Error on  getting details:', err);
        res.status(500).send('Failed at getting booking id');
    }
});

//updating seats, if seats_required < prev then we directly update and release the seats else we check the availability and update accordingly
app.put('/booking/:id', async (req, res) => {
    const bookingId = req.params.id;
    const { seats_required } = req.body;

    if (!seats_required) {
        return res.status(400).send('Seats required field is missing');
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const bookingResult = await client.query('SELECT * FROM bookings WHERE id = $1 FOR UPDATE', [bookingId]);
        const booking = bookingResult.rows[0];

        if (!booking) {
            return res.status(404).send('Booking not found');
        }

        const trainResult = await client.query('SELECT * FROM trains WHERE id = $1 FOR UPDATE', [booking.train_id]);
        const train = trainResult.rows[0];

        if (!train) {
            return res.status(404).send('Train not found');
        }

        if (seats_required > booking.seats_required) {
            const extraSeatsRequired = seats_required - booking.seats_required;

            if (extraSeatsRequired <= train.seats) {
                await client.query('UPDATE trains SET seats = seats - $1 WHERE id = $2', [extraSeatsRequired, train.id]);
                await client.query('UPDATE bookings SET seats_required = $1 WHERE id = $2', [seats_required, bookingId]);
                await client.query('COMMIT');
                res.json({ message: 'Seats updated successfully' });
            } else {
                res.status(400).send('Not enough seats available for the update');
            }
        } else if (seats_required < booking.seats_required) {
            const seatsToRelease = booking.seats_required - seats_required;
            await client.query('UPDATE trains SET seats = seats + $1 WHERE id = $2', [seatsToRelease, train.id]);
            await client.query('UPDATE bookings SET seats_required = $1 WHERE id = $2', [seats_required, bookingId]);
            await client.query('COMMIT');
            res.json({ message: 'Seats updated successfully' });
        } else {
            res.status(400).send('No change in seat requirement');
        }
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Update error:', error);
        res.status(500).send('Failed to update booking');
    } finally {
        client.release();
    }
});

app.listen(3000, () => {
console.log('Server is running on port 3000');
});
