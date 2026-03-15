# Helix Logs
A logger browser for the Helix and impulse roleplaying frameworks written in Node.js with Typescript.

![demo](https://i.imgur.com/bEDbdJe.gif)

# Features
- Steam login
- Usergroup whitelist
- MySQL and SQLite support
- SAM, Serverguard, ULX and impulse native admin support
- Search filters
  - Messages
  - Before and after dates
  - Steam ID's
- Native impulse log table support
- HTTP and HTTPS support
- Mobile friendly
- Download logs contextually
- Docker support
- Rate limiting support
- Contextual logs

# Requirements
- **Node.js 20+** (includes npm).
- **MySQL/MariaDB** with access to your framework tables (Helix tables or impulse log tables).
- **Steam Web API key** (for Steam OAuth login).
- **Admin source compatibility**: `ulx`, `serverguard`, `sam`, or `impulse`.
- **Framework/log source**:
  - Helix + SQL logger plugin, or
  - native impulse log table support.
- **Redis** recommended for production deployments.

# Getting started
- Clone the repository
```
git clone --depth=1 https://github.com/willardnetworks/logs.git <project_name>
```
- Install dependencies
```
cd <project_name>
npm install
```
This installs runtime packages and build tooling used by this project (`typescript`, `ts-node`, `sass`, `eslint`).

- Build the app
```
npm run build
```

- Configuration

Rename the `.env.example` file to `.env` and fill out the environment variables

| Environment Variable                            	| Description                                                                                                            	|
|-------------------------------------------------	|------------------------------------------------------------------------------------------------------------------------	|
| NODE_ENV (production/dev)                       	| Whether we are running in development or production. Enables error logger and sets the domain to localhost in dev.     	|
| SESSION_SECRET                                  	| Secret used for keeping sessions. You should use a random generator for this.                                          	|
| WEBSITE_DOMAIN                                  	| Your website's domain, used for redirecting to steam.                                                                  	|
| PORT                                            	| The port your server listens on.                                                                                       	|
| SSL (true/false)                                	| Whether you want the server to use HTTPS, you will need this if you have your SSL mode to full (strict) in cloudflare. 	|
| SSL_CERT, SSL_KEY                                 | The absolute path of your SSL certificate and key if you are using HTTPS. You can create these with openssl.            |
| DATABASE (mysql)                        	        | What type of database you have.                                                                                        	|
| MYSQL_USER, MYSQL_PASS,<br>MYSQL_HOST, MYSQL_DB 	| Login credentials for mysql.                                                                                           	|
| MYSQL_SAM                                       	| The database name for SAM.                                                                                          	  |
| LOG_FRAMEWORK (auto/helix/impulse)             	  | Which log schema to read. `auto` will detect impulse tables first, then fall back to Helix.                          	  |
| IMPULSE_LOG_TABLE                              	  | Optional override for the impulse log table name. Default is `impulse_logs`.                                          	|
| ADMIN_MOD (serverguard/ulx/sam/impulse)           | The admin system your server uses. For impulse, rank lookup uses `impulse_players.usergroup` with SteamID64.            |
| STEAM_KEY                                       	| Steam API key, get yours at https://steamcommunity.com/dev/apikey.                                                     	|
| ALLOWED_RANKS                                   	| List of allowed usergroups that can access the server logs, separated by semicolons.                                   	|
- Build and run the project
```
npm run build
npm start
```

Finally, navigate to `http://localhost:3000` and you should see the template being served and rendered locally!

# Deployment
To deploy the app to a web server, simply set it to production and add your own website domain.
> IP addresses work too, but you should use a domain to be able to use Cloudflare's DDoS protection.

SSL is strongly recommended, you can combine Cloudflare's full (strict) HTTPS with a self signed certificate using openssl for full end-to-end encryption.

# Debugging
Type `npm run debug` in your terminal to perform a full build and then server the app in watch mode. `npm run watch` if you are not using static assets.
> VS Code lets you easily run npm scripts from the editor

![i9G14KU 1](https://user-images.githubusercontent.com/36643731/123026088-378b3f00-d3a1-11eb-9dbb-873bf0a7e21e.png)

# Disclaimer
This is a fork of [Helix Logs](https://github.com/itz-coffee/helix-logs) by [itz-coffee](https://github.com/itz-coffee)
