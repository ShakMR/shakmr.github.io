import { defineConfig } from "tinacms";
import Post from "./collections/post";

export default defineConfig({
  clientId: 'clientid',
  branch: 'branch',
  token: 'token',
  build: {
    outputFolder: "admin",
    publicFolder: "static",
  },
  media: {
    tina: {
      mediaRoot: "uploads",
      publicFolder: "static",
    },
  },
  schema: {
    collections: [Post],
  },
});
