import { Component } from "solid-js";

const Stats: Component = () => {
  return (
    <section class="py-20 bg-muted">
      <div class="container mx-auto text-center px-4">
        <h2 class="text-3xl font-bold mb-10 text-foreground">Our Impact</h2>
        <div class="flex flex-col md:flex-row justify-around">
          <div class="mb-6 md:mb-0">
            <p class="text-4xl font-bold text-primary">10M</p>
            <p class="text-muted-foreground">Users</p>
          </div>
          <div class="mb-6 md:mb-0">
            <p class="text-4xl font-bold text-primary">500K</p>
            <p class="text-muted-foreground">Companies</p>
          </div>
          <div>
            <p class="text-4xl font-bold text-primary">100+</p>
            <p class="text-muted-foreground">Countries</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Stats;
