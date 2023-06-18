const express = require('express');
const app = express();
require('dotenv').config();
const cors = require('cors');
const port = process.env.PORT || 5000;
const jwt = require('jsonwebtoken');
const corsOptions ={
  origin:'*',
  credentials:true,
  optionSuccessStatus:200,
  }
  app.use(cors(corsOptions))


// middleware

app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized access' });
  }
  // bearer token
  const token = authorization.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    req.decoded = decoded;
    next();
  })
}

const { MongoClient, ServerApiVersion } = require('mongodb');

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.rpuxevk.mongodb.net/?retryWrites=true&w=majority`;

// const uri = "mongodb+srv://schoolUser:LMtJvjOu8lHMju8L@cluster0.rpuxevk.mongodb.net/?retryWrites=true&w=majority";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 10,
});

async function run() {
  try {

    

    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    client.connect((error)=>{
      if(error){
        console.log(error)
        return;
      }
    });

    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })

      res.send({ token })
    })

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      if (user?.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'forbidden message' });
      }
      next();
    }


    // users
    const usersCollection = client.db("bistroDb").collection("users");
     app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email }
      const existingUser = await usersCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: 'user already exists' })
      }

      const result = await usersCollection.insertOne(user);
      res.send(result);
    });


     app.get('/users/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ admin: false })
      }

      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === 'admin' }
      res.send(result);
    })
    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'admin'
        },
      };

      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);

    })



    const classesCollection = client.db("schooldb").collection("Classes");

    app.get('/classes', async(req,res)=>{
        const result = await classesCollection.find().toArray();
        res.send(result);
    })
    

    app.post('/classes', verifyJWT, verifyAdmin, async (req, res) => {
      const newItem = req.body;
      const result = await classesCollection.insertOne(newItem)
      res.send(result);
    })

    app.delete('/classes/:id', verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await classesCollection.deleteOne(query);
      res.send(result);
    })

    const instructorCollection = client.db("schooldb").collection("Instructor");

    app.get('/instructors', async(req,res)=>{
        const result = await instructorCollection.find().toArray();
        res.send(result);
    })

    app.post('/instructors', verifyJWT, verifyAdmin, async (req, res) => {
      const newItem = req.body;
      const result = await instructorCollection.insertOne(newItem)
      res.send(result);
    })

    app.delete('/instructors/:id', verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await instructorCollection.deleteOne(query);
      res.send(result);
    })

    const reviewsCollection = client.db("schooldb").collection("Reviews");

    app.get('/reviews', async(req,res)=>{
        const result = await reviewsCollection.find().toArray();
        res.send(result);
    })

      app.get('/carts', verifyJWT, async (req, res) => {
      const email = req.query.email;

      if (!email) {
        res.send([]);
      }

      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ error: true, message: 'forbidden access' })
      }

      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });

    const cartCollection = client.db("schooldb").collection("carts");

    app.post('/carts', async (req,res)=> {
      const item =req.body;
      console.log(item);
      const result = await cartCollection.insertOne(item);
      res.send(result);
    })
      app.delete('/carts/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    })

    // create payment intent
    app.post('/create-payment-intent', verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });

      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })
    / payment related api
    app.post('/payments', verifyJWT, async (req, res) => {
      const payment = req.body;
      const insertResult = await paymentCollection.insertOne(payment);

      const query = { _id: { $in: payment.cartItems.map(id => new ObjectId(id)) } }
      const deleteResult = await cartCollection.deleteMany(query)

      res.send({ insertResult, deleteResult });
    })

    app.get('/admin-stats', verifyJWT, verifyAdmin, async (req, res) => {
      const users = await usersCollection.estimatedDocumentCount();
      const products = await menuCollection.estimatedDocumentCount();
      const orders = await paymentCollection.estimatedDocumentCount();

      // best way to get sum of the price field is to use group and sum operator
      /*
        await paymentCollection.aggregate([
          {
            $group: {
              _id: null,
              total: { $sum: '$price' }
            }
          }
        ]).toArray()
      */

      const payments = await paymentCollection.find().toArray();
      const revenue = payments.reduce( ( sum, payment) => sum + payment.price, 0)

      res.send({
        revenue,
        users,
        products,
        orders
      })
    })
    app.get('/order-stats', verifyJWT, verifyAdmin, async(req, res) =>{
      const pipeline = [
        {
          $lookup: {
            from: 'menu',
            localField: 'menuItems',
            foreignField: '_id',
            as: 'menuItemsData'
          }
        },
        {
          $unwind: '$menuItemsData'
        },
        {
          $group: {
            _id: '$menuItemsData.category',
            count: { $sum: 1 },
            total: { $sum: '$menuItemsData.price' }
          }
        },
        {
          $project: {
            category: '$_id',
            count: 1,
            total: { $round: ['$total', 2] },
            _id: 0
          }
        }
      ];

      const result = await paymentCollection.aggregate(pipeline).toArray()
      res.send(result)

    })



    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send("school running")
})

app.listen(port,() => {
    console.log(`school ON ${port}`);
})