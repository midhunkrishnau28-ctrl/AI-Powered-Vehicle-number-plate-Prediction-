import os
import shutil
import random

def split_dataset(src_images, src_labels, dest_root, split_ratio=0.8):
    images = [f for f in os.listdir(src_images) if f.endswith('.jpg')]
    random.seed(42)
    random.shuffle(images)
    
    split_idx = int(len(images) * split_ratio)
    train_images = images[:split_idx]
    val_images = images[split_idx:]
    
    def move_files(files, split_name):
        for f in files:
            img_src = os.path.join(src_images, f)
            lbl_src = os.path.join(src_labels, f.replace('.jpg', '.txt'))
            
            img_dest = os.path.join(dest_root, 'images', split_name, f)
            lbl_dest = os.path.join(dest_root, 'labels', split_name, f.replace('.jpg', '.txt'))
            
            if os.path.exists(lbl_src):
                shutil.copy(img_src, img_dest)
                shutil.copy(lbl_src, lbl_dest)
            else:
                print(f"Skipping {f}, no label found at {lbl_src}")

    move_files(train_images, 'train')
    move_files(val_images, 'val')
    print("Dataset successfully split and organized.")

if __name__ == "__main__":
    split_dataset(
        src_images='dataset_raw/Data-Images/Cars',
        src_labels='dataset_raw/Data-Images/Labels',
        dest_root='dataset'
    )
