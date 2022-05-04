#!/bin/bash

tmpdir=$(mktemp -d)
gfortran pulumi.f90 -o ${tmpdir}/pulumi -I $(brew --prefix)/Cellar/json-fortran/8.2.5/include/ $(brew --prefix)/Cellar/json-fortran/8.2.5/lib/libjsonfortran.a
${tmpdir}/pulumi

trap 'rm -rf -- "${tmpdir}"' EXIT

