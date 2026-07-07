# Changelog

## [2.3.1](https://entrustcorp.ghe.com/Entrust/idaas-auth-js/compare/v2.3.0...v2.3.1) (2026-07-07)


### Bug Fixes

* remove postinstall script that broke npm install for consumers ([#44](https://entrustcorp.ghe.com/Entrust/idaas-auth-js/issues/44)) ([aefeebc](https://entrustcorp.ghe.com/Entrust/idaas-auth-js/commit/aefeebc1c128a610d62da70277dfac13c3f52eb6))

## [2.3.0](https://entrustcorp.ghe.com/Entrust/idaas-auth-js/compare/v2.2.0...v2.3.0) (2026-07-06)


### Features

* implement DPoP (Demonstration of Proof-of-Possession) support across authentication flows ([#1](https://entrustcorp.ghe.com/Entrust/idaas-auth-js/issues/1)) ([46da3e3](https://entrustcorp.ghe.com/Entrust/idaas-auth-js/commit/46da3e3df0437a72752daf9038ca57a952471e42))

## [2.2.0](https://github.com/EntrustCorporation/idaas-auth-js/compare/v2.1.0...v2.2.0) (2026-06-15)


### Features

* add JWT signature validation and update related tests ([1fdccb8](https://github.com/EntrustCorporation/idaas-auth-js/commit/1fdccb8ae1c65b031442366cc75d62328fd64323))
* add support for requested ACR values in ID token validation and related authentication flows ([7870c9a](https://github.com/EntrustCorporation/idaas-auth-js/commit/7870c9a1b1d076c8080c765886d8653b4f15d117))
* make openid scope optional ([aca66be](https://github.com/EntrustCorporation/idaas-auth-js/commit/aca66bec6a183ad49aa32f208de2fc1dc4030488))

## [2.1.0](https://github.com/EntrustCorporation/idaas-auth-js/compare/v2.0.0...v2.1.0) (2026-05-26)


### Features

* update IDaaS API to v5.45 ([ffb3277](https://github.com/EntrustCorporation/idaas-auth-js/commit/ffb32776623965cfdcfd3f60119db6213c94cb1c))
* update IDaaS API to v5.46 ([0926a88](https://github.com/EntrustCorporation/idaas-auth-js/commit/0926a88d98dc1974d29b1ebfc3d37b7182c6e308))


### Bug Fixes

* pin fflate to 0.8.2 to fix attw lint:types check ([1c85638](https://github.com/EntrustCorporation/idaas-auth-js/commit/1c8563870bc4e9a7980933c0b61282bbe1c4a26b))
* update IDaaS API download URL and add error handling ([eb958e5](https://github.com/EntrustCorporation/idaas-auth-js/commit/eb958e5b7558f80834ddc94773b75f48f308a8ef))
* use array syntax for bunfig.toml preload ([1a154c7](https://github.com/EntrustCorporation/idaas-auth-js/commit/1a154c7ada8bd0b523c90a364f5c527069f4bf04))

## [2.0.0](https://github.com/EntrustCorporation/idaas-auth-js/compare/v1.0.0...v2.0.0) (2026-05-14)


### ⚠ BREAKING CHANGES

* tokenOptions.acrValues type changed from string[] to string

### Features

* add parseResponse for stepup ([b3a5abc](https://github.com/EntrustCorporation/idaas-auth-js/commit/b3a5abc1ba849fad070bfc15186794255a8dd717))

## [1.0.0](https://github.com/EntrustCorporation/idaas-auth-js/compare/v0.2.1...v1.0.0) (2026-03-13)


### ⚠ BREAKING CHANGES

* migrate from typescript private to javascript private element

### Bug Fixes

* **passkey:** validate signature presence and handle userHandle correctly ([b1ce1f6](https://github.com/EntrustCorporation/idaas-auth-js/commit/b1ce1f65e5fe783056efcd90a73680f48d5e2db2)), closes [#163](https://github.com/EntrustCorporation/idaas-auth-js/issues/163)
* remove error type in onfido init ([f68198e](https://github.com/EntrustCorporation/idaas-auth-js/commit/f68198eb6ee1a775457df77ee396b59a0f4f34bd))


### Code Refactoring

* migrate from typescript private to javascript private element ([97c510b](https://github.com/EntrustCorporation/idaas-auth-js/commit/97c510b9cdb9e20223b1a566122ab5cc47c3b067))

## [0.2.1](https://github.com/EntrustCorporation/idaas-auth-js/compare/v0.2.0...v0.2.1) (2025-11-15)


### Bug Fixes

* add prompt=consent for offline_access ([#56](https://github.com/EntrustCorporation/idaas-auth-js/issues/56)) ([6b8b83b](https://github.com/EntrustCorporation/idaas-auth-js/commit/6b8b83bc33761c633a28e10cc9d1703514683152))

## [0.2.0](https://github.com/EntrustCorporation/idaas-auth-js/compare/v0.1.43...v0.2.0) (2025-11-14)


### Features

* add GitHub Actions workflows for CI and npm publishing ([8031184](https://github.com/EntrustCorporation/idaas-auth-js/commit/8031184cb0ef166ef4a198573201e7755e2132ac))
* add storage ([5919ee5](https://github.com/EntrustCorporation/idaas-auth-js/commit/5919ee5efbf869accfd5387fe3b8fae717897af3))
* added acr values to requestchallenge ([36b9534](https://github.com/EntrustCorporation/idaas-auth-js/commit/36b9534cb9a394288474e5685d5cb02ad0a4f38a))
* **docs:** enhance self-hosted documentation ([b375b72](https://github.com/EntrustCorporation/idaas-auth-js/commit/b375b725cbdd8d8a0795265fe28d58d3bbc87f35))


### Bug Fixes

* (remove TODO comment) ([9d8f1ae](https://github.com/EntrustCorporation/idaas-auth-js/commit/9d8f1ae8d6f3fefbda4ce83d7bc36d3ef307dd51))
* **deps:** update all non-major dependencies ([e20b77c](https://github.com/EntrustCorporation/idaas-auth-js/commit/e20b77cdb3af01e06aa6bfcdc5c9fb9291823cb4))
* **deps:** update all non-major dependencies ([730be57](https://github.com/EntrustCorporation/idaas-auth-js/commit/730be575eda0f3efc0804bb01fa401577d532ca2))
* **deps:** update all non-major dependencies ([5328cac](https://github.com/EntrustCorporation/idaas-auth-js/commit/5328cacdf55684e9d151d2524589567047afb945))
* drop port from rpId ([92f0917](https://github.com/EntrustCorporation/idaas-auth-js/commit/92f0917894c0a582bb4d08bb1e08b8bec4c63f03))
* update bun.lock and bunfig.toml for dependency versions and linker configuration ([8fac541](https://github.com/EntrustCorporation/idaas-auth-js/commit/8fac5410d1f40782ec94bd909c9f0320b2d93ef8))
* update jose dependency version to allow minor updates. fixes [#48](https://github.com/EntrustCorporation/idaas-auth-js/issues/48) ([6c0a0e4](https://github.com/EntrustCorporation/idaas-auth-js/commit/6c0a0e4f11a7483b3d3359f680ae41b1a842e6bb))
