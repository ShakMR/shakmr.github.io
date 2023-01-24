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

We need to allow all CRUD operations in a Post, plus list, and we want to also filter or search post via title 

Post: 
- Create
- Read
- Update
- Delete
- List (title)
- Media 

For media we only need creation and deletion

Media: 
- Create
- Delete

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

### 2. Input/Output

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
metadata as needed for example pagination information, etc. Furthermore, we might want to add extra information 
(other entities) if needed.§ 

### 3. Errors

We want our API to be understood by machines and also by humans. When defining errors we need to have this in mind. Machines 
should be able to understand the API errors to be able to know **when** an something happened and react appropriately 
(for example HTTP 500 error). Humans need to be able to know what happen too. Think about the details on a form validation (HTTP 400).

Some examples:

```json
  {
    "errors": [
      {
        "code": "ERR-1234",
        "title": "Validation Error",
        "detail": "Username is required",
        "source": { "pointer": "/data/attributes/username" },
        "status": "400"
      }
    ]
  }
```

Following the same approach as with successful request. We return the errors namespaced in an array. 
We could also add more information in the payload as we require. JSON-API standard defines a `meta` attribute for this, but
we won't use it here.

More info on error response in JSON-API [here](https://jsonapi.org/format/#errors) and [some examples here](https://jsonapi.org/examples/#error-objects)

#### HTTP Status code

There are some APIs out there which return HTTP status also on error. I've worked with some of those and, personally, I
find it useless and confusing. HTTP defines error codes for any kind of response we might want and using them just makes sense.

In this API we will explicitly use:
- 200 for success request
- 201 for success creation of an entity
- 400 when the input provided by the client is invalid.
- 404 when the resource doesn't exist (invalid UUID).

There are some error codes which are handled by the framework itself, for example 405 when a method is not defined for a route.

### 4. Show me the code

Up until now we have defined how to talk with our API, what the API provides and what can we expect from it.

Let's see this in a code example. For this API we are using Typescript and NestJS. We will focus on the controllers mainly
as we are interested in the API layer for now.

#### LIST
```typescript
@Controller('posts')
export class PostController {
  constructor(@Inject('PostService') private service: PostServiceInterface) {
  }

  @UseInterceptors(ClassSerializerInterceptor)
  @Get()
  async getAll(@Query('search') search: string): Promise<ApiResponse<PostDTO[]>> {
    return {
      data: (await this.service.getAll(search)).map((p) => new PostDTO(p)),
      metadata: {},
    };
  }
}
```

In the code above we implement the LIST action on the Post entity. We take the `search` query parameter as input if 
is there (`undefined` otherwise) and we call `getAll` from the service passing the data. Then the data is sent as response
using the namespacing and with a small transformation.

We are iterating over all the posts and creating a new `PostDTO`.

```typescript
import { Exclude } from "class-transformer";

export class PostDTO {
  @Exclude()
  id: number;

  uuid: string;
  title: string;
  description: string;

  constructor(partial: Partial<PostDTO>) {
    Object.assign(this, partial);
  }
}
```
In this piece of code we are simply removing the id of the Post as we don't want to expose it to the clients. However for
this to work we need to tell NestJS we want to intercept the output and transform it. This is done via the `@UseInterceptors(ClassSerializerInterceptor)`
decorator.

Interceptors in NestJS sit between the client and the controller handler and transform the information flowing in both 
directions if necessary. In this case we use the `class-transformer` package to exclude the id (more [here](https://docs.nestjs.com/techniques/serialization)).

We define this PostDTO object separated from the model which is used internally. So the service will return a Post instead of a PostDTO.

```
GET http://localhost:3000/posts/?search=Travel
```

```json
{
  "data": [
    {
      "uuid": "00000000-0000-0000-0000-000000000001",
      "title": "Travel through Africa",
      "description": "This is my post about my trip to Africa"
    },
    {
      "uuid": "00000000-0000-0000-0000-000000000002",
      "title": "Travel through South America",
      "description": "This are my pics from my trip to South America"
    },
    {
      "uuid": "00000000-0000-0000-0000-000000000003",
      "title": "Travel to the Moon",
      "description": "This are my pics from my space trip"
    }
  ],
  "metadata": {}
}
```

If case the `search` parameter doesn't match with at least one element we will just return an empty array. There's no need
to handle explicit errors here.

### READ

The read endpoint is a bit more interesting as we need to handle the error case when the UUID doesn't match any Post.

```typescript
@Controller('posts')
export class PostController {
  constructor(@Inject('PostService') private service: PostServiceInterface) {}

  // ...

  @UseInterceptors(ClassSerializerInterceptor)
  @Get(':uuid')
  async getOne(@Param('uuid') uuid: string): Promise<ApiResponse<PostDTO>> {
    const post = await this.service.getByUuid(uuid);

    if (!post) {
      throw new HttpException(
        {
          code: 'ERR-1',
          status: `${HttpStatus.NOT_FOUND}`,
          title: 'Not found',
          details: "The Post requested couldn't be found",
        },
        HttpStatus.NOT_FOUND,
      );
    }

    return {
      data: new PostDTO(post),
      metadata: {},
    };
  }
}
```

We take the `uuid` from the path params, and we send it to the service to get that single item back.

In this case there the option the `uuid` doesn't exist so we through an error using a NestJS built in exception.
But by default this exception doesn't give us the format we want in the output. NestJS provides exception filters for 
that matter. 

```typescript
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();

    response.status(status).json({
      errors: exception.getResponse(),
    });
  }
}
```

We add this in the bootstrapping of the application using `app.useGlobalFilters(new HttpExceptionFilter());` and in the 
App module as a provider, and it will transform all the errors, the ones fired by us explicitly and the ones generated by
the framework.