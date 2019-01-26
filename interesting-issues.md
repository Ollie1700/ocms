# Interesting issues during development

## Dynamically packing content
Had to use webpack to dynamically compile and pack the OCMS engine

## Creating template routes with require dynamically
You cannot dynamically `require` in node because the require statement is parsed before the JavaScript is run, so variables do not have values yet.

## Service Worker requests and responses are blobs
Service worker responses are immutable blobs, so I had to figure out what a blob was and create one manually with edited data.
