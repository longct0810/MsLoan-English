const app = require('./app');
const env = require('./config/env');

app.listen(env.app.port, env.app.host, () => {
  console.log(`${env.app.name} running at ${env.app.baseUrl}`);
  console.log(`Mode: ${env.demo.enabled ? 'DEMO DATA' : 'POSTGRESQL'}`);
  console.log(`Environment: ${env.app.nodeEnv}`);
});
