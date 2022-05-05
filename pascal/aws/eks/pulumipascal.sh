#!/bin/bash
fpc pulumi.pas
./pulumi

trap 'rm -rf -- "${tmpdir}"' EXIT
