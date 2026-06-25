extern crate alloc;

pub mod world {
    use soroban_sdk::Env;

    #[derive(Clone, Debug, Eq, PartialEq)]
    pub struct SimpleWorld;

    impl SimpleWorld {
        pub fn new(_env: &Env) -> Self {
            Self
        }
    }
}

pub mod app {
    use crate::alloc::boxed::Box;
    use crate::alloc::vec::Vec;
    use crate::cougr_core::world::SimpleWorld;
    use soroban_sdk::Env;

    #[derive(Clone, Copy, Debug, Eq, PartialEq)]
    pub enum ScheduleStage {
        PreUpdate,
        Update,
        PostUpdate,
    }

    #[allow(clippy::type_complexity)]
    pub struct System {
        pub name: &'static str,
        pub stage: ScheduleStage,
        pub f: Box<dyn Fn(&mut SimpleWorld, &Env)>,
    }

    impl System {
        pub fn in_stage(mut self, stage: ScheduleStage) -> Self {
            self.stage = stage;
            self
        }
    }

    pub fn named_system<F>(name: &'static str, f: F) -> System
    where
        F: Fn(&mut SimpleWorld, &Env) + 'static,
    {
        System {
            name,
            stage: ScheduleStage::Update, // default stage is Update
            f: Box::new(f),
        }
    }

    pub trait SystemsTuple {
        fn add_to_app(self, app: &mut GameApp);
    }

    impl SystemsTuple for System {
        fn add_to_app(self, app: &mut GameApp) {
            app.systems.push(self);
        }
    }

    impl SystemsTuple for (System, System, System) {
        fn add_to_app(self, app: &mut GameApp) {
            app.systems.push(self.0);
            app.systems.push(self.1);
            app.systems.push(self.2);
        }
    }

    pub struct GameApp {
        env: Env,
        pub world: SimpleWorld,
        pub systems: Vec<System>,
    }

    impl GameApp {
        pub fn new(env: &Env) -> Self {
            Self {
                env: env.clone(),
                world: SimpleWorld::new(env),
                systems: Vec::new(),
            }
        }

        pub fn add_systems<T: SystemsTuple>(&mut self, tuple: T) {
            tuple.add_to_app(self);
        }

        pub fn run(&mut self) {
            // Execute PreUpdate stage
            for sys in &self.systems {
                if sys.stage == ScheduleStage::PreUpdate {
                    (sys.f)(&mut self.world, &self.env);
                }
            }
            // Execute Update stage
            for sys in &self.systems {
                if sys.stage == ScheduleStage::Update {
                    (sys.f)(&mut self.world, &self.env);
                }
            }
            // Execute PostUpdate stage
            for sys in &self.systems {
                if sys.stage == ScheduleStage::PostUpdate {
                    (sys.f)(&mut self.world, &self.env);
                }
            }
        }
    }
}
