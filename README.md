# alchemy-effect

Alchemy Effect is an Infrastructure-as-Effects (iae) framework that unifies Business Logic and Infrastructure-as-Code into a unified model that ensures least-privilege IAM Policies with the TypeScript type system:
1. *Resources* are declared in your code
2. *Business Logic* is expressed as Effects accessing those resources
3. *Bindings* are attached to Functions, Workers, Hosts, etc. and type-checked ensure least-privilege IAM policies

<img src="./images/alchemy-effect.gif" alt="alchemy-effect demo" width="600"/>

<sub><i>Example showing type-safe IAM policies &ndash; it is not possible to under or over provide bindings.</i></sub>
