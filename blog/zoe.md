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
Based on the [Richardson Maturity Model](https://en.wikipedia.org/wiki/Richardson_Maturity_Model) (RMM) an API can be in 4 maturity
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

Before implementing the API I want to know what do I need, so let's draw some things first. Even though I've included `User`
we will leave it outside of the discussion for now.


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

_You can find the complete code [here](https://github.com/ShakMR/restful-api)_ 

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

    const exceptionResponse = exception.getResponse();
    if (typeof exceptionResponse === 'string') {
      response.status(status).json({
        errors: {
          title: exceptionResponse,
          detail: exceptionResponse,
          status: `${status}`,
        },
      });
    }

    const { statusCode, error, message, ...rest } = exceptionResponse as any;
    response.status(status).json({
      errors: {
        title: error,
        detail: message,
        ...rest,
        status: `${statusCode || status}`,
      },
    });
  }
}
```

We add this in the bootstrapping of the application using `app.useGlobalFilters(new HttpExceptionFilter());` and in the 
App module as a provider, and it will transform all the errors, the ones fired by us explicitly and the ones generated by
the framework.

### POST

```typescript
@Controller('posts')
export class PostController {
  constructor(@Inject('PostService') private service: PostServiceInterface) {
  }

  // ...

  @UseInterceptors(ClassSerializerInterceptor)
  @Post()
  async create(@Body() postDTO: PostDTO) {
    const post = await this.service.create(postDTO);

    return {
      data: new PostDTO(post),
      metadata: {},
    };
  }
}
```

For this endpoint we added input validation. In NestJS we can do this using Pipes. Pipes receive the input before the 
endpoint handler does and can perform transformations and/or validations. For our create endpoint we will be validating
if the `title` and `description` of the post are provided.

For this reason we did small changes in the `PostDTO` object.

```typescript
import { Exclude } from 'class-transformer';
import { IsNotEmpty } from 'class-validator';

export class PostDTO {
  @Exclude()
  id: number;

  uuid?: string;
  @IsNotEmpty()
  title: string;

  @IsNotEmpty()
  description: string;

  constructor(partial: Partial<PostDTO>) {
    Object.assign(this, partial);
  }
}
```

The `@IsNotEmpty` validate both that the attribute is present in the payload and that it is not empty.
the `class-validator` package provides more simple validators like `@IsInt`, `@Max(number)`, etc. Check docs 
[here](https://www.npmjs.com/package/class-validator#usage).

The last step to make this work is to tell NestJS to use that validator as a pipe. We do this in the bootstrap as we did 
for the filter.

```typescript
...
import { ValidationPipe } from '@nestjs/common';
...
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(new ValidationPipe());
  await app.listen(3000);
}
```

So far we can get, create and list posts, but we cannot get the media linked to it and that's the whole point of 
an instagram like app, isn't it?

### 5. Relations

In the planning of the endpoints we listed an subresource endpoint to get the media for a post.

| Action | Endpoint              | Controller      |
|--------|-----------------------|-----------------|
| Media  | GET /post/:uuid/media | MediaController |

This is simple and valid but, it also means the client has to fetch the media for each post after getting one or multiple
of them. Imagine the client request 100 posts and has to do one request for each of them to get the Media. It could be an
option if your app doesn't require that information. For example, think about comments in a post which are hidden by default.

In our case Media is all we want to see so how do we get them?

1. Compound Documents: When we request the posts we load the related media and return it in the same request in another namespace.

```json
{
  "data": [
    {
      "uuid": "00000000-0000-0000-0000-000000000001",
      "title": "Travel through Africa",
      "description": "This is my post about my trip to Africa",
      "media": ["00000000-0000-0000-0000-000000000001"]
    }
  ],
  "links": {
    "media": [
      {
        "uuid": "00000000-0000-0000-0000-000000000001",
        "src": "https://example.com/picture.png"
      }
    ]
  }
}
```

This option requires the client to search through the media to be able to get the information which is necessary for a post.
It smells like it won't scale so well for our case. 

When could we use this approach?
Imagine we add a country location in our post. The number of countries in the world might be big but surely is finite and
most of the time the user will be around the same area. In order to save some payload (imaging the country information 
is not only the name but some other data, images, facts, etc.) we add them in on the side, so they can be reused.

2. Embedded Documents: we add the data nested in the object.

```json
{
  "data": [
    {
      "uuid": "00000000-0000-0000-0000-000000000001",
      "title": "Travel through Africa",
      "description": "This is my post about my trip to Africa",
      "media": [
        {
          "uuid": "00000000-0000-0000-1111-000000000001",
          "src": "https://example.com/picture.png"
        }
      ]
    }
  ]
}
```

The media in our API is related to one and only one post so adding it here will be even better than the compound option 
in terms of payload size, and we don't have to work it out to get the media from the other array.

But what if we just want to list the posts without related elements? Easy, we use query params.

```
  GET /posts/?include=media
```

In this case we will query the media related to the post, otherwise we just return the Post. However, in our API the main
use case is including the media, so I prefer to include the media by default and then use the `?exclude=media` query param
if necessary.

```
  GET /posts/?exclude=media
```

Let's modify the Get and List endpoint to get this data then.

```typescript
@Controller('posts')
export class PostController {
  constructor(@Inject('PostService') private service: PostServiceInterface) {
  }

  @UseInterceptors(ClassSerializerInterceptor)
  @Get()
  async getAll(
          @Query('search') search: string,
          @Query('exclude') exclude: 'media',
  ): Promise<ApiResponse<PostDTO[]>> {
    return {
      data: (
              await this.service.getAll({
                search,
                includeMedia: !exclude || exclude !== 'media',
              })
      ).map((p) => {
        const transformedMedia = p.media.map((m) => new MediaDTO(m));
        return new PostDTO({...p, media: transformedMedia});
      }),
      metadata: {},
    };
  }

  @UseInterceptors(ClassSerializerInterceptor)
  @Get(':uuid')
  async getOne(
          @Param('uuid') uuid: string,
          @Query('exclude') exclude?: 'media',
  ): Promise<ApiResponse<PostDTO>> {
    const post = await this.service.getByUuid(uuid, {
      includeMedia: !exclude || exclude !== 'media',
    });

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
      data: new PostDTO({
        ...post,
        media: post.media.map((m) => new MediaDTO(m)),
      }),
      metadata: {},
    };
  }
  ...
}
```

Notice the change in both endpoints is passing to the service the includeMedia and then transforming the Media model into
MediaDTO. The PostService will be calling the MediaService to get the medias for that post.

We will assume that we are able to create and delete Media as the planning said, but we won't go into detail about it here
as there's not much it will add.

### 6. Where are we going?

We are currently at level 2 of the RMM. Usually we stop climbing the RMM ladder at this point, and we focus on other 
aspects of the API.
For example, we could implement pagination in the Post List endpoint, add authentication to make our posts safe or add Swagger
to our API (we really should do this one, and it's quite easy with NestJS).

The next level of the RMM might be controversial. **HATEOAS**. People will say the API is not RESTful without it. 
Some people don't care at all about it. We can see examples using it in the 
[Spring REST API tutorial](https://spring.io/guides/tutorials/rest/) and [articles](https://medium.com/@andreasreiser94/why-hateoas-is-useless-and-what-that-means-for-rest-a65194471bc8) against it too.

Personally, I kind of agree with the author of the article in Medium. Why adding something nobody will use in your API?.\
There aren't many tools that allow you to create **HATEOAS** in, let's say ExpressJS or NestJS don't provide one. I guess 
there won't ever be one because people don't use it and the other way around.

Anyway, I think it's an interesting concept we should at least know, and it might be useful in some cases.

In our Post entity there are three relations we care about: self, its own collection and media. So in **HATEOAS** it 
would look like this:

```json
{
  "data": [
    {
      "uuid": "00000000-0000-0000-0000-000000000001",
      "title": "Travel through Africa",
      "description": "This is my post about my trip to Africa",
      "_links": {
        "self": "/posts/00000000-0000-0000-0000-000000000001",
        "media": "/posts/00000000-0000-0000-0000-000000000001/media",
        "posts": "/posts"
      }
    }
  ]
}
```

### 7. Show me the HATEOAS code

Unfortunately there aren't too many packages helping with this and the ones I found in npm.org don't look too 
promising to me. So we will code it ourselves.

```typescript
@Injectable()
class PostTransformer {
  constructor(
    @Inject('MediaTransformer') private mediaTransformer: MediaTransformer,
  ) {}

  addLinks(postDto: PostDTO): HateoasPost {
    return {
      ...postDto,
      _links: {
        self: `/posts/${postDto.uuid}`,
        media: `/posts/${postDto.uuid}/media`,
        posts: '/posts/',
      },
    };
  }

  toDTO(post: Post): HateoasPost {
    const postDTO = new PostDTO({
      ...post,
      media: this.mediaTransformer.toDTOCollection(post.media),
    });

    return this.addLinks(postDTO);
  }

  toDTOCollection(posts: Post[]): HateoasPost[] {
    return posts.map((post) => this.toDTO(post));
  }
}
```

This PostTransformer is responsible for transforming the model to the schema we serve through the API. This means removing
the attributes we don't want to show to the clients (IDs) and adding **HATEOAS** links.

Now the output of the get looks like this
```
GET http://localhost:3000/posts/?exclude=media
```
```json
{
  "data": [
    {
      "id": 1,
      "uuid": "00000000-0000-0000-0000-000000000001",
      "title": "Travel through Africa",
      "description": "This is my post about my trip to Africa",
      "_links": {
        "self": "/posts/00000000-0000-0000-0000-000000000001",
        "media": "/posts/00000000-0000-0000-0000-000000000001/media",
        "posts": "/posts/"
      }
    },
    {
      "id": 2,
      "uuid": "00000000-0000-0000-0000-000000000002",
      "title": "Travel through South America",
      "description": "This are my pics from my trip to South America",
      "_links": {
        "self": "/posts/00000000-0000-0000-0000-000000000002",
        "media": "/posts/00000000-0000-0000-0000-000000000002/media",
        "posts": "/posts/"
      }
    },
    ...
  ],
  "metadata": {}
}
```

To mention one usefull use case of this hypermedia links, imagine we implement this in the `Create` action. We send the 
data to the server, the entity is created and returned to us. If there are no hypermedia links we normally assume there's 
an ID I can use to query that specific element and do other actions like PUT or DELETE. But we will have to build the URI
ourselves. What if the URI is not exactly what we think? Well hypermedia has you covered because you could use the `self`
link provided to query it without having to build anything or even think about it.

### 8. Conclusion

With this we have build a small RESTful API (including hypermedia) using Typescript and NestJS. There's still a lot to 
add to this API for it to work in a production like environment for this app tho (pagination, authentication, documentation)

Testing is covered in the repository, although we didn't do it explicitly in this piece of text.

Hateoas might not be interesting for some people, we might not use it in production environments or whatever but now we 
now it exists. There are other API technologies out there that tackle things differently that we might want to use instead
like GraphQL or GRPC. We will evaluate the options in each use case and chose accordingly.

### 9. Next step

Maybe we could fully implement the MediaController and the User Module?