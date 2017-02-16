import java.util.*;
import java.lang.*;
import java.io.*;

class Main
{
	public static void main (String[] args) throws java.lang.Exception
	{
		int array = new int[100];

	}

	/* Maps over an array of integers, passing each element as
	 * an argument to an apply function 
	 */
	public void map(int array, Callable<Integer> myFunc) {

		for (int i = 0; i < array.size; i++) {
			myFunc(array[i]);
		}
	}
}
