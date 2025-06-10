#!/usr/bin/env node

import { run } from 'cmd-ts';
import { promptCommand } from './cli';
import React from 'react';
import { render, Text } from 'ink';

// Run the command line program
run(promptCommand, process.argv.slice(2));