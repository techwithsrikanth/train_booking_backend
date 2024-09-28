# Train Ticket Booking

## Overview
This is a backend used for train ticket management,  we can see the list of trains and the user can pick the train id and book a certain amount of seats with a added feature of updating the seats of the booking incase he wants to change the number of seats booked from the previous booking.

## Features
- **Framework** -  Node.js and a robust backend to handle multiple requests
- **Updating Seats and management** -  If user had previously booked 10 seats and now wants to remove 3 seats, he can update the number of seats accordingly (PUT)
- **Login and register** - Basic user registeration and login

## Deployed URL
  URL : https://trainbookingspbackend1239.onrender.com

REQUESTS EXAMPLES: 


### Register
**POST** 
### https://trainbookingspbackend1239.onrender.com/register
```json
{
    "email": "testuser2@example.com",
    "password": "testuser2"
}
```
### Login
**POST** 
### https://trainbookingspbackend1239.onrender.com/login
```
{
    "email": "testuser2@example.com",
    "password": "testuser2"
}
```
### Checking availability
**GET**
###  https://trainbookingspbackend1239.onrender.com/availability?from=Mumbai&to=Jaipur

```
[
    {
        "id": 1,
        "from_station": "Mumbai",
        "to_station": "Jaipur",
        "seats": 425
    }
]
```

### Booking tickets
**POST**

### https://trainbookingspbackend1239.onrender.com/book

```
{
    "email": "testuser@example.com",
    "train_id": 1,
    "seats_required": 30
}
```


### Updating the previously booked ticket seats (from 7 to 5 for example)
**PUT**

### https://trainbookingspbackend1239.onrender.com/booking/:id

```

{
    "seats_required": 5
}

```


### Retrieving the booking details
**GET**
### https://trainbookingspbackend1239.onrender.com/booking/:id 

params : id -> we get the booking details of the particular id (train_id and seats booked)

