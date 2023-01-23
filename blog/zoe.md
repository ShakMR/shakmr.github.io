# Building a RESTful API with Typescript

In this article I'll explain some concepts regarding building RESTful APIs and use
NodeJS (with TypeScript) as example. I'll focus mainly in the API layer and not go too
deep into services/domain and repositories/dal.

## What is a REST API

There are a lot of kinds of API. Some of them are newer (GraphQL), some of them are
obsolete (SOAP). REST (REpresentational State Transfer) are one of the more well-spread kinds and we talk about RESTful
APIs when an API is based in REST. But not all the APIs which are based in REST are RESTful, even when they claim so. 

_Confesion: I've created APIs which I called RESTful in the past, but they were not. I don't do that anymore. I still
create them but not call them RESTful anymore._

### What is RESTful then?
Based on the [Richardson Maturity Model](https://en.wikipedia.org/wiki/Richardson_Maturity_Model) an API can be in 4 maturity
levels, 0 being not REST related at all, 4 being completely RESTful.

- Level 0: Swamp of POX
  - Doesn't classify as RESTful
  - SOAP, RPC POX and URI handling all the types of requests
  - POST over HTTP
- Level 1: Resources
  - Still not RESTful
  - One URI per resource instead of one endpoint
- Level 2: HTTP Verbs
  - Start using verbs (GET, POST, PUT, DELETE, etc.)
  - Still not RESTful
  - Usually we stop here when creating REST APIs
- Level 3: Hypermedia Controls
  - Introduces hypermedia. HATEOAS (Hypermedia As The Engine of Application State)

Example from wikipedia:

Request
``` 
GET /room/?customerId=1&date=10-11-2020&hotelCode=ASTORIA HTTP/1.1
```

Response
```json
{
    "customerId": "1",
    "reservations": [{
        "room": "102",
        "checkin": "10-11-2020",
        "checkout": "11-14-2020",
        "price": "100",
        "href": "https://localhost:8080/room/102"
    }]
}
```

Notice the `href` attribute in the reservations object.

## The API

This API was originally thought to serve as a source for an Instagram-like website I was creating for myself. I'll remove
some things, assume some others for the sake of making my life and everyone else simpler.

### 1. Endpoint planning

Before implementing the API I want to know what do I need, so let's draw some things first.


| ![Entity diagram](media/diagram.png) |
|--------------------------------------|
| <center> *Entity Diagram* </center>  |

I need to allow all CRUD operations in a Post

Post: 
- Create
- Read
- Update
- Delete

I also want to see this posts not individually but all together.

Post:
- Create
- Read
- Update
- Delete
- **List**

Also, I want to allow for searches based on the title of the Post:

Post:
- Create
- Read
- Update
- Delete
- **List** (title)

And finally I want to upload images and others to a specific Post.

Post:
- Create
- Read
- Update
- Delete
- List (title)
- Media

The complete API will look like this

Post:
- Create
- Read
- Update
- Delete
- List (title)
- Media

User: 
- Create
- Read
- Update
- Delete 

Media: 
- Create
- Delete

For the sake of simplicity we will leave the User entity outside this article.

#### Routing

Lets defined the routes.

| Action | Endpoint              | Controller      |
|--------|-----------------------|-----------------|
| Create | POST /posts           | PostController  |
| Read   | GET /posts/:uuid      | PostController  |
| Update | PUT /posts/:uuid      | PostController  |
| Delete | DELETE /posts/:uuid   | PostController  |
| List   | GET /posts            | PostController  |
| Media  | GET /post/:uuid/media | MediaController |
| Create | POST /users           | UserController  |
| Get    | GET /users/:uuid      | UserController  |
| Put    | PUT /users/:uuid      | UserController  |
| Delete | DELETE /users/:uuid   | UserController  |
| Create | POST /media           | MediaController |
| Delete | DELETE /media/:uuid   | MediaController |

#### Entities identifier

In these routes we use UUIDs to operate on a single instance of an entity. When I was learning about Databases in college 
we used the auto increment ID as general ID for referencing one entry in a foreign key for example. As I moved into
programming websites or APIs I kept using auto increment ID for referencing data in the website and clients.

With time, I switched to using UUID in order to reference entities outside the system who owns the data. In the routes above 
I'll do the same. 

Why not using auto increment IDs? Well, we will use them internally in our system. The DB will still use those for foreign keys.
Consumers of the API shouldn't care about an ID auto incrementing, and if they do it might not be for good. So I will use
a random ID (UUID) and protect the API from scrapping/scripts and people knowing too much.

#### Entities names

In the endpoint list we chose names in plural for the entities. We could have chosen names in singular for single instance operations (create, update, etc)
and plurals for multiple instances (list, search, etc) but for the sake of consistency I prefer to use plural directly 
for all of them.

### Input/Output

All the endpoints defined above will receive input, send output or both (most of the time). 

In regard to the **input**, it's quite simple. We either use query parameters (GET) or request body (POST, PUT). There's also
some input in the route structure, in our case the UUID.

```
  GET /posts?search=home
  Host: localhost
```

In the request above we input `home` as value for the parameter `search`, we want to get all the posts matching the word 
`home` in their title. It is quite simple and easy for the consumers as long as they have knowledge of it's existence. 

```
  POST /user
  Host: localhost
  Authentication: Bearer <token>
  Content-Type: application/json
  
  { "username": "username1" }
```

Now we are creating a new user with `username` `username1`. Also, simple as long as the client knows all the information
needed to create the entity and the headers are specified properly. The documentation of the API should help here.

The output of the API, however, might be more complicated.

The easy solution is to just response with the entity as it comes from the service and/or repository. As we are using 
Javascript it make sense to use JSON as response format. Also, who wants XML in their API? 😜

List endpoint:

```
  GET /posts
```

```
  [
    {
      "uuid": "00000000-0000-0000-0000-000000000001"
      "title": "Post number 1"
      "description": "This is my first post... #newhere",
      "media": [ ... ]
    },
    ...
  ]
```

For a single instance we could return a structure like the following.

```
  GET /posts/00000000-0000-0000-0000-000000000001
```

```
  {
    "uuid": "00000000-0000-0000-0000-000000000001"
    "title": "Post number 1"
    "description": "This is my first post... #newhere",
    "media": [ ... ]
  }
```

For list endpoint we might want to add more information which doesn't belong to instance data. For example, as is it a list
we might want to add metadata regarding the page or the total amount of items available, etc. In the current structure we 
won't be able to do so without polluting it. Not to say we have an array as base structure, where do we insert this?

We can solve this by using namespaces:

```
  {
    "posts": [
      {
        "uuid": "00000000-0000-0000-0000-000000000001"
        "title": "Post number 1"
        "description": "This is my first post... #newhere",
        "media": [ ... ]
      },
      ...
    ],
    "metadata": {
      "total": 1000
    }
  }
```

In the case of the single instance, we have the same problem. But what namespace we use here? Do we use `"posts": [...]`
as well? It will be bad for clients as having an array that always returns an item is confusing.
If we use `"post"` in singular we will have some inconsistency in the endpoints response, sometimes plural, sometimes singular.

```
  {
    data: [
        {
          "uuid": "00000000-0000-0000-0000-000000000001"
          "title": "Post number 1"
          "description": "This is my first post... #newhere",
          "media": {
            data: [ ... ]
          }
        },
        ...
      ],
      "metadata": {
        "total": 1000
      }
    ]
  }
```

```
  {
    data: {
      "uuid": "00000000-0000-0000-0000-000000000001"
      "title": "Post number 1"
      "description": "This is my first post... #newhere",
      "media": {
        data: [ ... ]
      }
    },
    metadata: { ... }
  }
```

In this way we have consistency in all the endpoints, with the root of the response being generic and we are able to add 
metadata as needed, as well as extra information (other entities) when needed.
