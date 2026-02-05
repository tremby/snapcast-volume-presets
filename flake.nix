{
  description = "snapcast-volume-presets packaged for nix";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
    in
    {
      packages = forAllSystems (system:
        let
          pkgs = import nixpkgs { inherit system; };
          pkg = builtins.fromJSON (builtins.readFile ./package.json);
        in
        {
          default = pkgs.buildNpmPackage rec {
            pname = pkg.name;
            version = pkg.version;

            src = ./.;
            npmDepsHash = "sha256-P1SM1soWmBKZCSMZaIDFKQ/0/KCSRoy7cV3H5VlYEag=";
            buildInputs = [ pkgs.nodejs_24 ];
            dontBuild = true;

            meta = {
              description = pkg.description;
              license = pkgs.lib.licenses.mit;
              mainProgram = pkg.bin;
            };
          };
        });

      defaultPackage = self.packages."x86_64-linux".default;

      devShells = forAllSystems (system:
        let pkgs = import nixpkgs { inherit system; };
        in
        {
          default = pkgs.mkShell {
            buildInputs = [ pkgs.nodejs_24 ];
          };
        });
    };
}

