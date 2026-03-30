The Netlify deploy errored, with the following guidance provided:

**Diagnosis**

- [Line 58](#L58) reports that the Netlify Functions bundler cannot load `@anthropic-ai/sdk` when packaging `netlify/functions/generate-mcq.js`.  
- [Lines 60-62](#L60-L62) confirm the module is missing from the deployed dependency tree, which means Netlify can’t bundle the function.

**Solution**

Add the missing dependency to your site’s root `package.json` and redeploy:

1. In the project root, verify whether `@anthropic-ai/sdk` is already declared in `package.json`. If it isn’t, add it to the `"dependencies"` section:
   ```json
   {
     "dependencies": {
       "@anthropic-ai/sdk": "^0.x.x"
     }
   }
   ```
   Use the latest compatible version from npm.

2. Install the dependency locally (e.g., `npm install` or `yarn install`) so that `package-lock.json`/`yarn.lock` is updated, then commit the changes.

3. Push the commit and trigger a new Netlify build.

The relevant error logs are:

Line 35:   deployId: 69cae425f76c970008d5c62b
Line 36: [36m[1m​[22m[39m
Line 37: [36m[1m❯ Current directory[22m[39m
Line 38:   /opt/build/repo
Line 39: [36m[1m​[22m[39m
Line 40: [36m[1m❯ Config file[22m[39m
Line 41:   No config file was defined: using default values.
Line 42: [36m[1m​[22m[39m
Line 43: [36m[1m❯ Context[22m[39m
Line 44:   production
Line 45: Failed during stage 'building site': Build script returned non-zero exit code: 2
Line 46: [96m[1m​[22m[39m
Line 47: [96m[1mFunctions bundling                                            [22m[39m
Line 48: [96m[1m────────────────────────────────────────────────────────────────[22m[39m
Line 49: ​
Line 50: Packaging Functions from [36mnetlify/functions[39m directory:
Line 51:  - generate-mcq.js
Line 52: ​
Line 53: [91m[1m​[22m[39m
Line 54: [91m[1mDependencies installation error                               [22m[39m
Line 55: [91m[1m────────────────────────────────────────────────────────────────[22m[39m
Line 56: ​
Line 57:   [31m[1mError message[22m[39m
Line 58:   A Netlify Function failed to require one of its dependencies.
Line 59:   Please make sure it is present in the site's top-level "package.json".
​
Line 60:   In file "/opt/build/repo/netlify/functions/generate-mcq.js"
Line 61:   Cannot find module '@anthropic-ai/sdk'
Line 62:   Require stack:
Line 63:   - /opt/buildhome/node-deps/node_modules/@netlify/zip-it-and-ship-it/dist/runtimes/node/bundlers/zisi/resolve.js
Line 64: ​
Line 65:   [31m[1mResolved config[22m[39m
Line 66:   build:
Line 67:     environment:
Line 68:       - ANTHROPIC_API_KEY
Line 69:     publish: /opt/build/repo/public
Line 70:     publishOrigin: ui
Line 71:   functionsDirectory: /opt/build/repo/netlify/functions
Line 72: Build failed due to a user error: Build script returned non-zero exit code: 2
Line 73: Failing build: Failed to build site
Line 74: Finished processing build request in 8.259s
