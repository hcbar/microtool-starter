import test from 'node:test';import assert from 'node:assert/strict';import {readConfig,checkConfig} from '../scripts/check.mjs';
test('product passes safety gates',()=>assert.equal(checkConfig(readConfig()),true));
test('advertising cannot be silently enabled',()=>{const x=structuredClone(readConfig());x.monetization.adsEnabled=true;assert.throws(()=>checkConfig(x),/No integration implemented/)});
test('site cannot index without confirmed HTTPS origin',()=>{const x=structuredClone(readConfig());x.indexable=true;x.siteUrl='';assert.throws(()=>checkConfig(x),/siteUrl/)});
test('backend and local profiles allowed',()=>{const x=structuredClone(readConfig());x.profile='backend';assert.equal(checkConfig(x),true);x.profile='weird';assert.throws(()=>checkConfig(x),/profile/)});
