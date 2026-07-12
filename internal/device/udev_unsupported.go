//go:build !linux

package device

func runUdevLoop(w *UdevWatcher) {
	<-w.stop
}
