const express = require("express");
const app = express();

app.use(express.json());

const { open } = require("sqlite");

const sqlite3 = require("sqlite3");

const jwt = require("jsonwebtoken");

const path = require("path");

const crypto = require("crypto");

const cloudinary = require("./cloudinary");

const dbPath = path.join(__dirname, "app.db");

let db = null;

const initializeServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(6000, () => {
      console.log("http://localhost/6000");
    });
  } catch (e) {
    console.log(`Db error ${e.message}`);
    process.exit(1);
  }
};

initializeServer();

const authenticationToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.title = payload.title;
        next();
      }
    });
  }
};

// post a image

app.post("/post-image/", async (request, response) => {
  const { title, desc, tag, image } = request.body;

  const uniqueId = crypto.randomUUID();

  const postQuery = `
    INSERT INTO
      wellness(id, title, desc, tag, image)
    VALUES
      ("${uniqueId}", "${title}", "${desc}", "${tag}", "${image}");`;

  const post = await db.run(postQuery);
  const Id = post.lastID;
  const payload = { title: title };
  const jwtToken = await jwt.sign(payload, "TOKEN");
  response.send({ jwtToken });
});

// get all post url

app.get("/get-images", authenticationToken, async (request, response) => {
  const imagesQuery = `SELECT * FROM wellness;`;
  const allImages = await db.all(imagesQuery);
  response.send(allImages);
});

// get specific image by id

app.get("/get-image/:id/", authenticationToken, async (request, response) => {
  const { id } = request.params;
  const imageQuery = `SELECT * FROM wellness WHERE id = "${id}";`;
  const image = await db.get(imageQuery);
  response.send(image);
});

// delete image by id

app.delete(
  "/image-delete/:id/",
  authenticationToken,
  async (request, response) => {
    const { id } = request.params;
    const deleteQuery = `DELETE FROM wellness WHERE id = "${id}";`;
    await db.run(deleteQuery);
    response.send("Image Deleted");
  }
);

// update image detail by id

app.put(
  "/image-update/:id/",
  authenticationToken,
  async (request, response) => {
    const { title, desc, tag, image } = request.body;
    const { id } = request.params;
    const updateQuery = `
    UPDATE wellness 
    SET 
      title = "${title}",
      desc = "${desc}",
      tag = "${tag}",
      image = "${image}"
    WHERE
      id = "${id}";`;
    await db.run(updateQuery);
    response.send("Image Details Updated");
  }
);

/*   An Option to sort, and paginate the data
     An Option keyword that filters the posts that contains that keyword either in the title or description
    •An Option Tag that gives us the posts associated with that particular tag. 
*/

app.get("/", authenticationToken, async (request, response) => {
  const { offset, limit, sort, keyword = "", tag } = request.query;

  const selectQuery = `
      SELECT * FROM 
        wellness 
      WHERE (title LIKE "%${keyword}%" 
      OR desc LIKE "%${keyword}%")
      AND tag = "${tag}"
      ORDER BY title ${sort}
      LIMIT ${limit}
      OFFSET ${offset};`;

  const images = await db.all(selectQuery);
  response.send(images);
});

// upload image on cloudinary

app.post(
  "/image-on-cloudinary",
  authenticationToken,
  async (request, response) => {
    const { imageUrl } = request.body;
    const result = await cloudinary.uploader.upload(imageUrl);
    response.send("image uploaded");
  }
);
