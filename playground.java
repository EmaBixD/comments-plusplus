/**
 * Binary Search Tree (BST) Implementation
 * 
 * NOTE: This is a playground file to showcase Comments++ features.
 * Hover over the image paths to see the tooltips! [media/logo.png]
 */
public class BinarySearchTree {

    // NOTE: Inner class representing a node in the tree.
    class Node {
        int key;
        Node left, right;

        public Node(int item) {
            key = item;
            left = right = null;
        }
    }

    Node root;

    // DEPRECATED: This constructor will be removed in v2.0. Use BinarySearchTree(int key) instead.
    BinarySearchTree() {
        root = null;
    }

    // TODO: We must implement AVL tree re-balancing. [CRITICAL] [@john] [@sarah] [2026-06-01]
    void insert(int key) {
        root = insertRec(root, key);
    }

    // HACK: Recursive insertion is bypassing the depth limit check. [@emabixd]
    Node insertRec(Node root, int key) {
        if (root == null) {
            root = new Node(key);
            return root;
        }
        
        // FIXME: Memory leak potential if the tree gets too deep. [HIGH] [media/icon.svg]
        if (key < root.key)
            root.left = insertRec(root.left, key);
        else if (key > root.key)
            root.right = insertRec(root.right, key);

        return root;
    }

    // TODO: Add the delete() method. [MEDIUM] [@sarah] [2026-05-10]
    // Currently, elements cannot be deleted without breaking the tree structure.
    
    public static void main(String[] args) {
        BinarySearchTree tree = new BinarySearchTree();
        tree.insert(50);
        tree.insert(30);
        tree.insert(20);
        tree.insert(40);
        tree.insert(70);
        
        // FIXME: The application crashes if we try to print an empty tree here. [CRITICAL] [@mario] [2026-04-14]
        System.out.println("Tree initialized recursively.");
    }
}
