//
// Copyright (c) Microsoft.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//

/*eslint no-console: ["error", { allow: ["warn", "log", "dir"] }] */

// The local environment script is designed to allow for local debugging, test and
// development scenarios. The go method is called with resolved configuration.

import { PostgresPoolQueryAsync } from '../lib/postgresHelpers';
import throat from 'throat';

async function go(providers: IProviders): Promise<void> {
  // ---------------------------------------------------------------------------  
  const _ = require('lodash');
  let links = await providers.linkProvider.getAll();
  // links = links.reverse();
  links = _.shuffle(links);
  // links = links.slice(0, 50);
  let i = 0;

  const throttle = throat(4);
  await Promise.all(links.map(link => throttle(async () => {
    try {
      const r = await PostgresPoolQueryAsync(providers.postgresPool,
        `
          SELECT 
            entityid, 
            entitytype, 
            ((metadata->'created')) as jsoncreated,
            ((metadata->'additionaldata'->>'contribution')::boolean) as jsoncontribution,
            metadata
          FROM
            events 
          WHERE
            (metadata->>\'usercorporateid\') = $1 
          AND
            entitytype=$2
          AND 
          (
              created IS NULL 
           OR usercorporateid IS NULL 
           OR isopencontribution IS NULL
           OR action IS NULL
           OR inserted IS NULL
          )
          `, [
        link.corporateId,
        'event',
      ]);
      console.log(`${++i}/${links.length}\t\t${r && r.rows ? r.rows.length : ''}`);
      if (r && r.rows) {
        // console.log(link.corporateId + ', ' + r.rows.length);
        const innerThrottle = throat(5);
        await Promise.all(r.rows.map(row => innerThrottle(async () => {
          const { entityid, entitytype, jsoncreated, jsoncontribution, metadata } = row;
          const created = new Date(jsoncreated);
          if (true) {
            try {
              let parameter = 0;
              const newMetadata = {...metadata};
              await PostgresPoolQueryAsync(providers.postgresPool, `
                UPDATE
                  events
                SET
                  isopencontribution = $${++parameter},
                  created = $${++parameter},
                  usercorporateid = $${++parameter},
                  action = $${++parameter},
                  userusername = $${++parameter},
                  userid = $${++parameter},
                  usercorporateusername = $${++parameter},
                  organizationname = $${++parameter},
                  organizationid = $${++parameter},
                  repositoryname = $${++parameter},
                  repositoryid = $${++parameter},
                  inserted = $${++parameter},
                  updated =  $${++parameter}
                  -- metadata = ,
                WHERE
                  entityid=$${++parameter}
                AND
                  entitytype=$${++parameter}
                `, [
                  jsoncontribution,
                  created,
                  link.corporateId,
                  metadata.action,
                  metadata.userusername,
                  metadata.userid,
                  metadata.usercorporateusername,
                  metadata.organizationname,
                  metadata.organizationid,
                  metadata.repositoryname,
                  metadata.repositoryid,
                  new Date(metadata.inserted),
                  new Date(),
                  //newMetadata,
                  entityid,
                  entitytype,
                ]);
            } catch (xe) {
              console.log(xe);
              console.log()
            }
          }
        })));
      }
    } catch (error) {
      console.log(error.message);
      console.log();
    }
  })));





  // ---------------------------------------------------------------------------
}




















// -----------------------------------------------------------------------------
// Local script initialization
// -----------------------------------------------------------------------------
import App, { IReposApplication } from '../app';
import { IProviders } from '../transitional';
import { quitInAMinute, asNumber } from '../utils';
import { date } from 'azure-storage';
import router from '../routes';

console.log('Initializing the local environment...');

let painlessConfigResolver = null;
try {
  painlessConfigResolver = require('painless-config-resolver')();
} catch (error) {
  console.log('Painless config resolver initialization error:');
  console.dir(error);
  throw error;
}

painlessConfigResolver.resolve((configurationError, config) => {
  if (configurationError) {
    throw configurationError;
  }
  return initialize(config);
});

function initialize(config) {
  console.log('Local configuration ready, initializing non-web app pipeline...');
  App.initializeJob(config, null, error => {
    if (error) {
      throw error;
    }
    console.log('Local environment started.');
    return go(App.settings.providers as IProviders).then(ok => {
      console.log('Local environment script complete.');
      quitInAMinute(true);
    }).catch(error => {
      console.error(error);
      console.dir(error);
      quitInAMinute(false);
    });
  });
}
