const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express')
const app = express();
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const port = process.env.PORT || 5000;

// middleware
app.use(cors({
      origin: [
            'http://localhost:5173',
            // 'https://dev-connect-bd.web.app',
            // 'https://dev-connect-bd.firebaseapp.com'
      ],
      credentials: true
}));
app.use(express.json());
app.use(cookieParser());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.d8abmis.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
      serverApi: {
            version: ServerApiVersion.v1,
            strict: true,
            deprecationErrors: true,
      }
});

const allJobCollection = client.db("devConnectBdDB").collection('allJobs');
const appliedJobCollection = client.db("devConnectBdDB").collection('appliedJobs');

// middleware 

// verify token
const verifyToken = (req, res, next) => {
      const token = req.cookies.token;
      if (!token) {
            res.status(401).send({ message: 'Unauthorized Access' })
      }
      jwt.verify(token, process.env.ACCESS_SECRET_TOKEN, (err, decoded) => {
            if (err) {
                  res.status(401).send({ message: 'Unauthorized Access' })
            }
            req.user = decoded
            console.log('decoded', decoded);
            next()
      })
}



async function run() {
      try {
            // Connect the client to the server	(optional starting in v4.7)
            await client.connect();

            // jwt
            app.post('/api/v1/auth/jwt', async (req, res) => {
                  const user = req.body;
                  const token = jwt.sign(user, process.env.ACCESS_SECRET_TOKEN, { expiresIn: '1h' })
                  res
                        .cookie('token', token, {
                              httpOnly: true,
                              secure: true,
                              sameSite: 'none',
                        })
                        .send({ message: true })

            })

            // clear token
            app.post('/api/v1/auth/logout', async (req, res) => {
                  const user = req.body;
                  res
                        .clearCookie('token', {
                              maxAge: 0,
                              secure: true,
                              sameSite: 'none',
                        },)
                        .send({ success: true })
            })

            // user api
            app.post('/api/v1/allJobs', async (req, res) => {
                  const job = req.body;
                  const result = await allJobCollection.insertOne(job);
                  res.send(result)
            })

            // get all jobs
            app.get('/api/v1/allJobs', async (req, res) => {
                  const result = await allJobCollection.find().toArray();
                  res.send(result)
            })

            app.get('/api/v1/jobs', verifyToken, async (req, res) => {

                  // // verify token owner
                  if (req.query?.userEmail !== req.user?.email) {
                        return res.status(403).send({ message: 'Forbidden' })
                  }

                  let query = {};
                  if (req.query.userEmail) {
                        query = { userEmail: req.query.userEmail }
                  }
                  const result = await allJobCollection.find(query).toArray();
                  res.send(result)
            })

            // get job by category
            app.get('/api/v1/allJobs/:category', async (req, res) => {
                  const { category } = req.params;
                  let query = { jobCategory: category };
                  const result = await allJobCollection.find(query).toArray();
                  res.json(result);
            });

            // get job by id || single job || job details
            app.get('/api/v1/allJobs/singleJobs/:id', async (req, res) => {
                  const id = req.params.id;
                  const query = { _id: new ObjectId(id) }
                  const result = await allJobCollection.findOne(query);
                  res.send(result)
            })

            // get job by id || single job || increment applicants
            app.get('/api/v1/allJobs/applicants/number/:id', async (req, res) => {
                  const id = req.params.id;
                  const query = { _id: new ObjectId(id) }
                  const result = await allJobCollection.findOne(query);
                  res.send(result)
            })

            // put/update job by id || single job || increment applicants
            app.put('/api/v1/allJobs/applicants/number/:id', async (req, res) => {
                  const id = req.params.id;
                  const query = { _id: new ObjectId(id) };
                  const job = await allJobCollection.findOne(query);
                  if (job) {
                        const updatedApplicantsNumber = job.applicantsNumber + 1;

                        const updateDoc = {
                              $set: {
                                    applicantsNumber: updatedApplicantsNumber
                              }
                        };
                  }
                  const result = await allJobCollection.updateOne(query, updateDoc);
                  res.send(result);
            })

            // update job || put method
            app.put('/api/v1/allJobs/singleJobs/:id', async (req, res) => {
                  const id = req.params.id;
                  const job = req.body;
                  const query = { _id: new ObjectId(id) }
                  const options = { upsert: true };
                  const updateDoc = {
                        $set: {
                              ...job
                        },
                  };
                  const result = await allJobCollection.updateOne(query, updateDoc, options)
                  res.send(result)
            })

            // delete job
            app.delete('/api/v1/allJobs/singleJobs/:id', async (req, res) => {
                  const id = req.params.id;
                  const query = { _id: new ObjectId(id) }
                  const result = await allJobCollection.deleteOne(query);
                  res.send(result);
            })


            // user || applied jobs

            app.get('/api/v1/user/appliedJobs', verifyToken, async (req, res) => {

                  // verify token owner
                  if (req.query?.loggedEmail !== req.user?.email) {
                        return res.status(403).send({ message: 'Forbidden' })
                  }

                  let query = {};
                  if (req.query.loggedEmail) {
                        query = { loggedEmail: req.query.loggedEmail };
                  }
                  const result = await appliedJobCollection.find(query).toArray();
                  res.send(result);
            });

            // applied jobs
            app.post('/api/v1/user/appliedJobs', async (req, res) => {
                  const job = req.body;
                  const isExist = await appliedJobCollection.findOne({ jobId: job.jobId, loggedUser: job.loggedUser })

                  if (isExist) {
                        res.send({ message: 'Already Added' })
                        return;
                  }
                  const result = await appliedJobCollection.insertOne(job);
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
      res.send('Dev Connect BD is running')
})

app.listen(port, () => {
      console.log(`Dev Connect BD is running on port ${port}`)
})