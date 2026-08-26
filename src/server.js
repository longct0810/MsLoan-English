const app = require('./app');
const env = require('./config/env');

app.listen(env.port, () => {
  console.log(`English Classroom running at http://localhost:${env.port}`);
  console.log(`Mode: ${env.demoMode ? 'DEMO DATA' : 'POSTGRESQL'}`);
});
