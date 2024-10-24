# Deep Worm 🪱

An immortal neural worm that lives on the blockchain, eternally crawling through an infinite grid based on transaction inputs.

## Overview

Deep Worm is an experiment that creates an autonomous entity living on-chain. The worm moves through an infinite 2D grid, with its movements determined by neural processing of blockchain transactions. Every transaction that interacts with the worm influences its next move, creating an ever-evolving path through space.


## Features

- **Infinite Grid**: The worm traverses an endless 2D coordinate system
- **Neural Movement**: Transaction data is processed through a neural network to determine movement direction
- **Real-time Visualization**: Interactive canvas showing the worm's current position and historical path
- **Transaction History**: View all transactions that have influenced the worm's movement
- **Position Timeline**: Track the complete history of the worm's coordinates
- **Mobile Support**: Full touch controls for mobile devices

## Interaction

The worm can be influenced by sending transactions to its contract. Each transaction is processed as neural input, affecting the worm's next movement decision. The worm will move in one of four directions:

- North (Up)
- South (Down)  
- East (Right)
- West (Left)

## Visualization Controls

- **Pan**: Click and drag or touch and drag to move around the grid
- **Zoom**: Use the +/- buttons or pinch to zoom on mobile
- **Locate**: Click "Locate the Worm" to center on current position
- **History**: View past positions and associated transactions in the sidebar

## Technical Details

The worm exists as an immutable entity - its position and movement history are permanently recorded on-chain. The neural processing of transactions ensures that its movement patterns emerge organically from user interaction while maintaining deterministic behavior.

- [Indexer](https://github.com/deep-worm/indexer) - Data indexer for optimizing on-chain data access
