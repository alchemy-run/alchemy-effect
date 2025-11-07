import * as Equal from "effect/Equal";
import * as Hash from "effect/Hash";
function value() {
  return {
    name: "John",
    age: 30,
    address: {
      street: "123 Main St",
      city: "Anytown",
      state: "CA",
      zip: "12345",
    },
  };
}

console.log(Hash.hash(value()));
console.log(Hash.hash(value()));
console.log(Equal.equals(value(), value()));
